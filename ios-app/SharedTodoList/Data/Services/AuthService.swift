import Foundation
import CryptoKit
import LocalAuthentication

/// Authentication errors
enum AuthError: LocalizedError {
    case invalidPIN
    case userNotFound
    case accountLocked(remainingSeconds: Int)
    case biometricsFailed
    case biometricsNotAvailable
    case sessionExpired
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidPIN:
            return "Invalid PIN. Please try again."
        case .userNotFound:
            return "User not found."
        case .accountLocked(let seconds):
            return "Account locked. Try again in \(seconds) seconds."
        case .biometricsFailed:
            return "Biometric authentication failed."
        case .biometricsNotAvailable:
            return "Biometric authentication is not available."
        case .sessionExpired:
            return "Your session has expired. Please log in again."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

/// Service for authentication operations
@Observable
final class AuthService {
    static let shared = AuthService()

    // MARK: - Properties

    private(set) var currentUser: User?
    private(set) var isAuthenticated = false
    private(set) var failedAttempts: Int = 0
    private(set) var lockoutEndTime: Date?

    private let userDefaults: UserDefaults
    private let sessionKey = "currentSession"
    private let biometricsKey = "useBiometrics"

    // MARK: - Initialization

    private init() {
        // Use app group for sharing with widgets
        if let groupDefaults = UserDefaults(suiteName: Config.appGroupIdentifier) {
            self.userDefaults = groupDefaults
        } else {
            self.userDefaults = .standard
        }

        // Restore lockout state
        restoreLockoutState()
    }

    // MARK: - PIN Hashing

    /// Hash PIN using SHA-256 (matches web app implementation)
    func hashPIN(_ pin: String) -> String {
        let data = Data(pin.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Lockout Management

    var isLocked: Bool {
        guard let endTime = lockoutEndTime else { return false }
        return Date() < endTime
    }

    var lockoutRemainingSeconds: Int {
        guard let endTime = lockoutEndTime else { return 0 }
        return max(0, Int(endTime.timeIntervalSinceNow))
    }

    private func restoreLockoutState() {
        if let lockoutEnd = userDefaults.object(forKey: "lockoutEndTime") as? Date {
            if Date() < lockoutEnd {
                lockoutEndTime = lockoutEnd
            } else {
                userDefaults.removeObject(forKey: "lockoutEndTime")
            }
        }
        failedAttempts = userDefaults.integer(forKey: "failedAttempts")
    }

    private func recordFailedAttempt() {
        failedAttempts += 1
        userDefaults.set(failedAttempts, forKey: "failedAttempts")

        if failedAttempts >= Config.maxLoginAttempts {
            lockoutEndTime = Date().addingTimeInterval(Config.lockoutDuration)
            userDefaults.set(lockoutEndTime, forKey: "lockoutEndTime")
        }
    }

    private func clearFailedAttempts() {
        failedAttempts = 0
        lockoutEndTime = nil
        userDefaults.removeObject(forKey: "failedAttempts")
        userDefaults.removeObject(forKey: "lockoutEndTime")
    }

    // MARK: - Authentication

    /// Authenticate user with PIN
    func login(user: User, pin: String) async throws -> Bool {
        // Check lockout
        if isLocked {
            throw AuthError.accountLocked(remainingSeconds: lockoutRemainingSeconds)
        }

        // Verify PIN
        let hashedPIN = hashPIN(pin)

        guard user.pinHash == hashedPIN else {
            recordFailedAttempt()
            throw AuthError.invalidPIN
        }

        // Success - clear failed attempts
        clearFailedAttempts()

        // Update last login on server
        do {
            try await SupabaseService.shared.updateUserLastLogin(userId: user.id)
        } catch {
            // Non-fatal - continue with login
            print("Failed to update last login: \(error)")
        }

        // Update streak
        await updateStreak(for: user)

        // Store session
        saveSession(for: user, useBiometrics: false)

        currentUser = user
        isAuthenticated = true

        return true
    }

    /// Logout current user
    func logout() {
        userDefaults.removeObject(forKey: sessionKey)
        currentUser = nil
        isAuthenticated = false
    }

    /// Switch to a different user (requires PIN)
    func switchUser(to user: User, pin: String) async throws -> Bool {
        logout()
        return try await login(user: user, pin: pin)
    }

    // MARK: - Session Management

    private func saveSession(for user: User, useBiometrics: Bool) {
        let session = UserSession(user: user, useBiometrics: useBiometrics)
        if let data = try? JSONEncoder().encode(session) {
            userDefaults.set(data, forKey: sessionKey)
        }
    }

    func getSavedSession() -> UserSession? {
        guard let data = userDefaults.data(forKey: sessionKey),
              let session = try? JSONDecoder().decode(UserSession.self, from: data) else {
            return nil
        }

        // Check session expiry if configured
        if Config.sessionExpiry > 0 {
            let elapsed = Date().timeIntervalSince(session.loginAt)
            if elapsed > Config.sessionExpiry {
                logout()
                return nil
            }
        }

        return session
    }

    /// Restore user from saved session
    func restoreSession(from users: [User]) -> Bool {
        guard let session = getSavedSession(),
              let user = users.first(where: { $0.id == session.userId }) else {
            return false
        }

        currentUser = user
        isAuthenticated = true
        return true
    }

    // MARK: - Biometric Authentication

    var biometricsAvailable: Bool {
        guard Config.biometricsEnabled else { return false }

        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometricType: LABiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }

    var biometricTypeName: String {
        switch biometricType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        @unknown default: return "Biometrics"
        }
    }

    var biometricIcon: String {
        switch biometricType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        @unknown default: return "lock.shield"
        }
    }

    var canUseBiometrics: Bool {
        guard biometricsAvailable else { return false }
        return getSavedSession()?.useBiometrics == true
    }

    /// Enable biometric authentication for current user
    func enableBiometrics() async throws {
        guard let user = currentUser else { return }
        guard biometricsAvailable else {
            throw AuthError.biometricsNotAvailable
        }

        // Verify biometrics work
        let success = try await authenticateWithBiometrics()
        if success {
            saveSession(for: user, useBiometrics: true)
        }
    }

    /// Disable biometric authentication
    func disableBiometrics() {
        guard let user = currentUser else { return }
        saveSession(for: user, useBiometrics: false)
    }

    /// Authenticate using biometrics
    func authenticateWithBiometrics() async throws -> Bool {
        guard biometricsAvailable else {
            throw AuthError.biometricsNotAvailable
        }

        let context = LAContext()
        let reason = "Unlock Shared Todo List"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )

            if success, let session = getSavedSession() {
                // Restore user from session
                let users = try await SupabaseService.shared.fetchUsers()
                if let user = users.first(where: { $0.id == session.userId }) {
                    currentUser = user
                    isAuthenticated = true
                    return true
                }
            }

            return false
        } catch {
            throw AuthError.biometricsFailed
        }
    }

    // MARK: - Streak Management

    private func updateStreak(for user: User) async {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        var newStreakCount = user.streakCount ?? 0

        if let lastDate = user.streakLastDate {
            let lastStreakDay = calendar.startOfDay(for: lastDate)
            let daysDiff = calendar.dateComponents([.day], from: lastStreakDay, to: today).day ?? 0

            if daysDiff == 0 {
                // Same day - no change
                return
            } else if daysDiff == 1 {
                // Consecutive day - increment
                newStreakCount += 1
            } else {
                // Streak broken - reset
                newStreakCount = 1
            }
        } else {
            // First login ever
            newStreakCount = 1
        }

        // Update on server
        do {
            try await SupabaseService.shared.updateUserStreak(
                userId: user.id,
                streakCount: newStreakCount,
                streakDate: today
            )
        } catch {
            print("Failed to update streak: \(error)")
        }
    }
}
