import Foundation
import SwiftData
import SwiftUI

// MARK: - User Role

enum UserRole: String, Codable, CaseIterable, Identifiable {
    case admin = "admin"
    case member = "member"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .admin: return "Admin"
        case .member: return "Member"
        }
    }

    var canSeeAllTasks: Bool {
        self == .admin
    }
}

// MARK: - User (API Model)

struct User: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var pinHash: String?
    var color: String
    var role: UserRole
    var createdAt: Date
    var lastLogin: Date?
    var streakCount: Int?
    var streakLastDate: Date?
    var welcomeShownAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, color, role
        case pinHash = "pin_hash"
        case createdAt = "created_at"
        case lastLogin = "last_login"
        case streakCount = "streak_count"
        case streakLastDate = "streak_last_date"
        case welcomeShownAt = "welcome_shown_at"
    }

    // MARK: - Computed Properties

    var uiColor: Color {
        Color(hex: color) ?? .blue
    }

    var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var isAdmin: Bool {
        role == .admin
    }

    var currentStreak: Int {
        streakCount ?? 0
    }

    var hasActiveStreak: Bool {
        guard let lastDate = streakLastDate else { return false }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let lastStreakDay = calendar.startOfDay(for: lastDate)
        let daysDiff = calendar.dateComponents([.day], from: lastStreakDay, to: today).day ?? 0
        return daysDiff <= 1
    }

    // MARK: - Initializers

    init(
        id: String = UUID().uuidString,
        name: String,
        pinHash: String? = nil,
        color: String = "#0033A0",
        role: UserRole = .member,
        createdAt: Date = Date(),
        lastLogin: Date? = nil,
        streakCount: Int? = nil,
        streakLastDate: Date? = nil,
        welcomeShownAt: Date? = nil
    ) {
        self.id = id
        self.name = name
        self.pinHash = pinHash
        self.color = color
        self.role = role
        self.createdAt = createdAt
        self.lastLogin = lastLogin
        self.streakCount = streakCount
        self.streakLastDate = streakLastDate
        self.welcomeShownAt = welcomeShownAt
    }
}

// MARK: - SwiftData Cached Model

@Model
final class CachedUser {
    @Attribute(.unique) var id: String
    var name: String
    var pinHash: String?
    var color: String
    var role: String
    var createdAt: Date
    var lastLogin: Date?
    var streakCount: Int
    var streakLastDate: Date?

    init(from user: User) {
        self.id = user.id
        self.name = user.name
        self.pinHash = user.pinHash
        self.color = user.color
        self.role = user.role.rawValue
        self.createdAt = user.createdAt
        self.lastLogin = user.lastLogin
        self.streakCount = user.streakCount ?? 0
        self.streakLastDate = user.streakLastDate
    }

    func update(from user: User) {
        self.name = user.name
        self.pinHash = user.pinHash
        self.color = user.color
        self.role = user.role.rawValue
        self.lastLogin = user.lastLogin
        self.streakCount = user.streakCount ?? 0
        self.streakLastDate = user.streakLastDate
    }

    func toUser() -> User {
        User(
            id: id,
            name: name,
            pinHash: pinHash,
            color: color,
            role: UserRole(rawValue: role) ?? .member,
            createdAt: createdAt,
            lastLogin: lastLogin,
            streakCount: streakCount,
            streakLastDate: streakLastDate
        )
    }
}

// MARK: - Session

struct UserSession: Codable {
    let userId: String
    let userName: String
    let userColor: String
    let userRole: UserRole
    let loginAt: Date
    let useBiometrics: Bool

    init(user: User, useBiometrics: Bool = false) {
        self.userId = user.id
        self.userName = user.name
        self.userColor = user.color
        self.userRole = user.role
        self.loginAt = Date()
        self.useBiometrics = useBiometrics
    }
}

// MARK: - Sample Data

extension User {
    static let sample = User(
        id: "sample-user-1",
        name: "Derrick",
        color: "#0033A0",
        role: .admin,
        streakCount: 5,
        streakLastDate: Date()
    )

    static let samples: [User] = [
        User(
            id: "sample-user-1",
            name: "Derrick",
            color: "#0033A0",
            role: .admin,
            streakCount: 5,
            streakLastDate: Date()
        ),
        User(
            id: "sample-user-2",
            name: "Sefra",
            color: "#D4A853",
            role: .member,
            streakCount: 3,
            streakLastDate: Date()
        )
    ]
}

// MARK: - Color Extension

extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0

        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            return nil
        }

        let length = hexSanitized.count
        let r, g, b, a: Double

        switch length {
        case 6: // RGB (24-bit)
            r = Double((rgb & 0xFF0000) >> 16) / 255.0
            g = Double((rgb & 0x00FF00) >> 8) / 255.0
            b = Double(rgb & 0x0000FF) / 255.0
            a = 1.0
        case 8: // ARGB (32-bit)
            a = Double((rgb & 0xFF000000) >> 24) / 255.0
            r = Double((rgb & 0x00FF0000) >> 16) / 255.0
            g = Double((rgb & 0x0000FF00) >> 8) / 255.0
            b = Double(rgb & 0x000000FF) / 255.0
        default:
            return nil
        }

        self.init(red: r, green: g, blue: b, opacity: a)
    }

    func toHex() -> String {
        guard let components = UIColor(self).cgColor.components else {
            return "#000000"
        }

        let r = Int(components[0] * 255)
        let g = Int(components[1] * 255)
        let b = Int(components[2] * 255)

        return String(format: "#%02X%02X%02X", r, g, b)
    }
}
