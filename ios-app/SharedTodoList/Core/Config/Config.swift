import Foundation

/// App configuration constants
enum Config {
    // MARK: - Secrets (loaded from Secrets.plist)

    private static let secrets: [String: Any] = {
        guard let path = Bundle.main.path(forResource: "Secrets", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path) as? [String: Any] else {
            print("⚠️ Secrets.plist not found. Using placeholder values.")
            return [:]
        }
        return dict
    }()

    // MARK: - Supabase

    /// Supabase project URL
    static var supabaseURL: String {
        secrets["SUPABASE_URL"] as? String ?? "https://your-project.supabase.co"
    }

    /// Supabase anonymous key
    static var supabaseAnonKey: String {
        secrets["SUPABASE_ANON_KEY"] as? String ?? "your-anon-key"
    }

    // MARK: - API

    /// Base URL for the web app API (AI endpoints)
    static var apiBaseURL: String {
        secrets["API_BASE_URL"] as? String ?? "https://shared-todo-list-production.up.railway.app"
    }

    /// Outlook Add-in API key (if needed)
    static var outlookAPIKey: String {
        secrets["OUTLOOK_API_KEY"] as? String ?? ""
    }

    // MARK: - App Groups

    /// App group identifier for sharing data with widgets
    static let appGroupIdentifier = "group.com.yourcompany.sharedtodolist"

    // MARK: - Keychain

    /// Keychain service identifier
    static let keychainService = "com.yourcompany.sharedtodolist"

    // MARK: - Feature Flags

    /// Enable/disable AI features
    static let aiEnabled = true

    /// Enable/disable voice input
    static let voiceInputEnabled = true

    /// Enable/disable biometric authentication
    static let biometricsEnabled = true

    /// Enable/disable offline mode
    static let offlineModeEnabled = true

    // MARK: - Sync Settings

    /// How often to sync in background (seconds)
    static let backgroundSyncInterval: TimeInterval = 900 // 15 minutes

    /// Maximum retry attempts for failed sync operations
    static let maxSyncRetries = 5

    /// Time before showing "offline" status (seconds)
    static let offlineThreshold: TimeInterval = 5

    // MARK: - UI Settings

    /// Maximum number of subtasks to show inline
    static let maxInlineSubtasks = 3

    /// Animation duration for standard transitions
    static let animationDuration: Double = 0.3

    // MARK: - Notification Settings

    /// Default reminder time before due date (seconds)
    static let defaultReminderOffset: TimeInterval = 3600 // 1 hour

    /// Available reminder options (in seconds)
    static let reminderOptions: [TimeInterval] = [
        900,     // 15 minutes
        1800,    // 30 minutes
        3600,    // 1 hour
        7200,    // 2 hours
        86400,   // 1 day
        172800   // 2 days
    ]

    // MARK: - Auth Settings

    /// PIN length
    static let pinLength = 4

    /// Maximum failed login attempts before lockout
    static let maxLoginAttempts = 3

    /// Lockout duration (seconds)
    static let lockoutDuration: TimeInterval = 30

    /// Session expiry (seconds) - 0 for never
    static let sessionExpiry: TimeInterval = 0

    // MARK: - Brand Colors

    enum Colors {
        static let primaryBlue = "#0033A0"
        static let goldAccent = "#D4A853"

        enum Priority {
            static let urgent = "#ef4444"
            static let high = "#f59e0b"
            static let medium = "#3b82f6"
            static let low = "#6b7280"
        }

        enum Status {
            static let todo = "#6366f1"
            static let inProgress = "#f59e0b"
            static let done = "#10b981"
        }
    }

    // MARK: - Debug

    #if DEBUG
    static let isDebug = true
    static let logNetworkRequests = true
    static let logSyncOperations = true
    #else
    static let isDebug = false
    static let logNetworkRequests = false
    static let logSyncOperations = false
    #endif
}

// MARK: - Environment-based Configuration

extension Config {
    enum Environment {
        case development
        case staging
        case production

        static var current: Environment {
            #if DEBUG
            return .development
            #else
            return .production
            #endif
        }
    }

    static var currentEnvironment: Environment {
        Environment.current
    }
}
