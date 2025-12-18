# Shared Todo List - iOS App Technical Specification

## Overview

A native iOS app (iPhone & iPad) that pairs with the existing Shared Todo List web app, providing full task management with real-time sync, offline support, and push notifications.

**Target**: iOS 17+ | iPhone & iPad | App Store Distribution

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Language** | Swift | 5.9+ |
| **UI Framework** | SwiftUI | iOS 17 |
| **Architecture** | MVVM + Repository Pattern | - |
| **State Management** | @Observable (Observation framework) | iOS 17 |
| **Local Database** | SwiftData | iOS 17 |
| **Backend** | Supabase iOS SDK | 2.x |
| **Networking** | URLSession + async/await | - |
| **Push Notifications** | APNs + Supabase Edge Functions | - |
| **Voice Input** | Speech Framework | - |
| **Widgets** | WidgetKit | - |
| **Shortcuts** | App Intents | iOS 17 |

---

## Project Structure

```
SharedTodoList/
├── App/
│   ├── SharedTodoListApp.swift          # App entry point
│   ├── AppDelegate.swift                 # Push notification handling
│   └── ContentView.swift                 # Root view with auth routing
│
├── Core/
│   ├── Config/
│   │   ├── Environment.swift             # API keys, URLs
│   │   └── Constants.swift               # App constants
│   │
│   ├── Extensions/
│   │   ├── Date+Extensions.swift
│   │   ├── String+Extensions.swift
│   │   ├── Color+Extensions.swift
│   │   └── View+Extensions.swift
│   │
│   └── Utilities/
│       ├── CryptoUtils.swift             # SHA-256 PIN hashing
│       ├── HapticManager.swift           # Haptic feedback
│       └── Logger.swift                  # Logging utility
│
├── Data/
│   ├── Models/
│   │   ├── Todo.swift                    # Todo model (Codable + SwiftData)
│   │   ├── Subtask.swift                 # Subtask model
│   │   ├── User.swift                    # User model
│   │   └── SyncOperation.swift           # Offline sync queue item
│   │
│   ├── Repositories/
│   │   ├── TodoRepository.swift          # Todo CRUD operations
│   │   ├── UserRepository.swift          # User operations
│   │   └── SyncRepository.swift          # Offline sync management
│   │
│   ├── Services/
│   │   ├── SupabaseService.swift         # Supabase client wrapper
│   │   ├── AuthService.swift             # PIN auth, biometrics
│   │   ├── AIService.swift               # AI endpoint calls
│   │   ├── SpeechService.swift           # Voice transcription
│   │   ├── NotificationService.swift     # Push notification handling
│   │   └── SyncService.swift             # Online/offline sync engine
│   │
│   └── Local/
│       ├── SwiftDataContainer.swift      # SwiftData configuration
│       ├── CachedTodo.swift              # SwiftData Todo entity
│       ├── CachedUser.swift              # SwiftData User entity
│       └── PendingOperation.swift        # SwiftData sync queue
│
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   │   ├── LoginView.swift           # Main login screen
│   │   │   ├── PINPadView.swift          # PIN entry component
│   │   │   ├── UserPickerView.swift      # User selection
│   │   │   └── CreateAccountView.swift   # New user registration
│   │   │
│   │   └── ViewModels/
│   │       └── AuthViewModel.swift       # Auth state management
│   │
│   ├── TaskList/
│   │   ├── Views/
│   │   │   ├── TaskListView.swift        # Main task list
│   │   │   ├── TaskRowView.swift         # Individual task row
│   │   │   ├── TaskFilterBar.swift       # Filter chips
│   │   │   ├── TaskSortMenu.swift        # Sort options
│   │   │   └── BulkActionBar.swift       # Multi-select actions
│   │   │
│   │   └── ViewModels/
│   │       └── TaskListViewModel.swift   # List state & filtering
│   │
│   ├── TaskDetail/
│   │   ├── Views/
│   │   │   ├── TaskDetailView.swift      # Full task editor
│   │   │   ├── SubtaskListView.swift     # Subtasks section
│   │   │   ├── SubtaskRowView.swift      # Individual subtask
│   │   │   ├── PriorityPicker.swift      # Priority selector
│   │   │   ├── StatusPicker.swift        # Status selector
│   │   │   └── RecurrencePicker.swift    # Recurrence options
│   │   │
│   │   └── ViewModels/
│   │       └── TaskDetailViewModel.swift # Task editing logic
│   │
│   ├── AddTask/
│   │   ├── Views/
│   │   │   ├── AddTaskView.swift         # Task creation sheet
│   │   │   ├── VoiceInputButton.swift    # Microphone button
│   │   │   ├── AIEnhanceButton.swift     # AI enhancement
│   │   │   └── SmartParseSheet.swift     # AI parse results
│   │   │
│   │   └── ViewModels/
│   │       └── AddTaskViewModel.swift    # Creation logic
│   │
│   ├── Kanban/
│   │   ├── Views/
│   │   │   ├── KanbanView.swift          # Kanban board (iPad optimized)
│   │   │   ├── KanbanColumn.swift        # Status column
│   │   │   └── KanbanCard.swift          # Draggable task card
│   │   │
│   │   └── ViewModels/
│   │       └── KanbanViewModel.swift     # Drag & drop logic
│   │
│   ├── Settings/
│   │   ├── Views/
│   │   │   ├── SettingsView.swift        # Settings screen
│   │   │   ├── ProfileSection.swift      # User profile
│   │   │   ├── NotificationSettings.swift # Push prefs
│   │   │   └── SecuritySettings.swift    # Biometrics toggle
│   │   │
│   │   └── ViewModels/
│   │       └── SettingsViewModel.swift
│   │
│   └── Shared/
│       ├── Components/
│       │   ├── AvatarView.swift          # User avatar (color circle)
│       │   ├── PriorityBadge.swift        # Priority indicator
│       │   ├── StatusBadge.swift          # Status indicator
│       │   ├── DueDateBadge.swift         # Due date chip
│       │   ├── ConnectionIndicator.swift  # Online/offline status
│       │   ├── EmptyStateView.swift       # Empty list placeholder
│       │   ├── LoadingView.swift          # Loading spinner
│       │   └── ConfirmationDialog.swift   # Reusable confirm dialog
│       │
│       └── Modifiers/
│           ├── ShakeEffect.swift          # Error shake animation
│           └── CelebrationEffect.swift    # Task complete confetti
│
├── Widgets/
│   ├── TodoWidgetBundle.swift            # Widget entry point
│   ├── TodayCountWidget.swift            # Small: counts
│   ├── UpcomingTasksWidget.swift         # Medium: next 3 tasks
│   └── TaskListWidget.swift              # Large: task preview
│
├── ShareExtension/
│   ├── ShareViewController.swift         # Share extension handler
│   └── ShareView.swift                   # Share UI
│
├── Intents/
│   ├── AddTaskIntent.swift               # Siri: "Add task..."
│   ├── ShowTasksIntent.swift             # Siri: "Show my tasks"
│   └── DueTodayIntent.swift              # Siri: "What's due today"
│
└── Resources/
    ├── Assets.xcassets                   # Images, colors, app icon
    ├── Localizable.strings               # Localization
    └── Info.plist                         # App configuration
```

---

## Data Models

### Todo Model

```swift
import Foundation
import SwiftData

// MARK: - Enums

enum TodoStatus: String, Codable, CaseIterable {
    case todo = "todo"
    case inProgress = "in_progress"
    case done = "done"

    var displayName: String {
        switch self {
        case .todo: return "To Do"
        case .inProgress: return "In Progress"
        case .done: return "Done"
        }
    }

    var color: Color {
        switch self {
        case .todo: return .indigo
        case .inProgress: return .orange
        case .done: return .green
        }
    }
}

enum TodoPriority: String, Codable, CaseIterable, Comparable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case urgent = "urgent"

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .urgent: return "Urgent"
        }
    }

    var color: Color {
        switch self {
        case .low: return .gray
        case .medium: return .blue
        case .high: return .orange
        case .urgent: return .red
        }
    }

    var sortOrder: Int {
        switch self {
        case .urgent: return 0
        case .high: return 1
        case .medium: return 2
        case .low: return 3
        }
    }

    static func < (lhs: TodoPriority, rhs: TodoPriority) -> Bool {
        lhs.sortOrder < rhs.sortOrder
    }
}

enum RecurrencePattern: String, Codable, CaseIterable {
    case daily = "daily"
    case weekly = "weekly"
    case monthly = "monthly"

    var displayName: String {
        switch self {
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        }
    }
}

// MARK: - Subtask

struct Subtask: Codable, Identifiable, Hashable {
    var id: String
    var text: String
    var completed: Bool
    var priority: TodoPriority
    var estimatedMinutes: Int?

    init(id: String = UUID().uuidString, text: String, completed: Bool = false, priority: TodoPriority = .medium, estimatedMinutes: Int? = nil) {
        self.id = id
        self.text = text
        self.completed = completed
        self.priority = priority
        self.estimatedMinutes = estimatedMinutes
    }
}

// MARK: - Todo (API/Supabase Model)

struct Todo: Codable, Identifiable, Hashable {
    var id: String
    var text: String
    var completed: Bool
    var status: TodoStatus
    var priority: TodoPriority
    var createdAt: Date
    var createdBy: String
    var assignedTo: String?
    var dueDate: Date?
    var notes: String?
    var recurrence: RecurrencePattern?
    var updatedAt: Date?
    var updatedBy: String?
    var subtasks: [Subtask]?

    enum CodingKeys: String, CodingKey {
        case id, text, completed, status, priority, notes, recurrence, subtasks
        case createdAt = "created_at"
        case createdBy = "created_by"
        case assignedTo = "assigned_to"
        case dueDate = "due_date"
        case updatedAt = "updated_at"
        case updatedBy = "updated_by"
    }

    // Computed properties
    var isOverdue: Bool {
        guard let dueDate = dueDate, !completed else { return false }
        return dueDate < Date()
    }

    var isDueToday: Bool {
        guard let dueDate = dueDate else { return false }
        return Calendar.current.isDateInToday(dueDate)
    }

    var completedSubtaskCount: Int {
        subtasks?.filter { $0.completed }.count ?? 0
    }

    var totalSubtaskCount: Int {
        subtasks?.count ?? 0
    }
}

// MARK: - SwiftData Cached Model

@Model
final class CachedTodo {
    @Attribute(.unique) var id: String
    var text: String
    var completed: Bool
    var status: String
    var priority: String
    var createdAt: Date
    var createdBy: String
    var assignedTo: String?
    var dueDate: Date?
    var notes: String?
    var recurrence: String?
    var updatedAt: Date?
    var updatedBy: String?
    var subtasksData: Data? // JSON encoded subtasks

    // Sync tracking
    var needsSync: Bool = false
    var lastSyncedAt: Date?
    var locallyDeleted: Bool = false

    init(from todo: Todo) {
        self.id = todo.id
        self.text = todo.text
        self.completed = todo.completed
        self.status = todo.status.rawValue
        self.priority = todo.priority.rawValue
        self.createdAt = todo.createdAt
        self.createdBy = todo.createdBy
        self.assignedTo = todo.assignedTo
        self.dueDate = todo.dueDate
        self.notes = todo.notes
        self.recurrence = todo.recurrence?.rawValue
        self.updatedAt = todo.updatedAt
        self.updatedBy = todo.updatedBy
        self.subtasksData = try? JSONEncoder().encode(todo.subtasks)
    }

    func toTodo() -> Todo {
        let subtasks: [Subtask]? = subtasksData.flatMap { try? JSONDecoder().decode([Subtask].self, from: $0) }

        return Todo(
            id: id,
            text: text,
            completed: completed,
            status: TodoStatus(rawValue: status) ?? .todo,
            priority: TodoPriority(rawValue: priority) ?? .medium,
            createdAt: createdAt,
            createdBy: createdBy,
            assignedTo: assignedTo,
            dueDate: dueDate,
            notes: notes,
            recurrence: recurrence.flatMap { RecurrencePattern(rawValue: $0) },
            updatedAt: updatedAt,
            updatedBy: updatedBy,
            subtasks: subtasks
        )
    }
}
```

### User Model

```swift
import Foundation
import SwiftData

enum UserRole: String, Codable {
    case admin = "admin"
    case member = "member"
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

    var uiColor: Color {
        Color(hex: color) ?? .blue
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
```

### Sync Operation Model

```swift
import Foundation
import SwiftData

enum SyncOperationType: String, Codable {
    case create
    case update
    case delete
}

@Model
final class PendingOperation {
    @Attribute(.unique) var id: String
    var operationType: String
    var entityType: String // "todo" or "user"
    var entityId: String
    var payload: Data? // JSON encoded entity data
    var createdAt: Date
    var retryCount: Int = 0
    var lastError: String?

    init(type: SyncOperationType, entityType: String, entityId: String, payload: Data?) {
        self.id = UUID().uuidString
        self.operationType = type.rawValue
        self.entityType = entityType
        self.entityId = entityId
        self.payload = payload
        self.createdAt = Date()
    }
}
```

---

## Core Services

### Supabase Service

```swift
import Foundation
import Supabase

@Observable
final class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }

    // MARK: - Todos

    func fetchTodos() async throws -> [Todo] {
        try await client
            .from("todos")
            .select()
            .order("created_at", ascending: false)
            .execute()
            .value
    }

    func createTodo(_ todo: Todo) async throws -> Todo {
        try await client
            .from("todos")
            .insert(todo)
            .select()
            .single()
            .execute()
            .value
    }

    func updateTodo(_ todo: Todo) async throws -> Todo {
        try await client
            .from("todos")
            .update(todo)
            .eq("id", value: todo.id)
            .select()
            .single()
            .execute()
            .value
    }

    func deleteTodo(id: String) async throws {
        try await client
            .from("todos")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    // MARK: - Users

    func fetchUsers() async throws -> [User] {
        try await client
            .from("users")
            .select()
            .execute()
            .value
    }

    func updateUserLastLogin(userId: String) async throws {
        try await client
            .from("users")
            .update(["last_login": Date().ISO8601Format()])
            .eq("id", value: userId)
            .execute()
    }

    // MARK: - Real-time Subscriptions

    func subscribeTodos(
        onInsert: @escaping (Todo) -> Void,
        onUpdate: @escaping (Todo) -> Void,
        onDelete: @escaping (String) -> Void
    ) -> RealtimeChannelV2 {
        let channel = client.channel("todos-channel")

        channel
            .onPostgresChange(InsertAction.self, table: "todos") { insert in
                if let todo: Todo = try? insert.decodeRecord() {
                    onInsert(todo)
                }
            }
            .onPostgresChange(UpdateAction.self, table: "todos") { update in
                if let todo: Todo = try? update.decodeRecord() {
                    onUpdate(todo)
                }
            }
            .onPostgresChange(DeleteAction.self, table: "todos") { delete in
                if let id = delete.oldRecord["id"]?.stringValue {
                    onDelete(id)
                }
            }

        Task {
            await channel.subscribe()
        }

        return channel
    }
}
```

### Auth Service

```swift
import Foundation
import CryptoKit
import LocalAuthentication

@Observable
final class AuthService {
    static let shared = AuthService()

    private(set) var currentUser: User?
    private(set) var isAuthenticated = false

    private let userDefaults = UserDefaults.standard
    private let sessionKey = "currentSession"

    struct Session: Codable {
        let userId: String
        let userName: String
        let loginAt: Date
    }

    private init() {
        restoreSession()
    }

    // MARK: - PIN Hashing (matches web app)

    func hashPIN(_ pin: String) -> String {
        let data = Data(pin.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Authentication

    func login(user: User, pin: String) async throws -> Bool {
        let hashedPIN = hashPIN(pin)

        guard user.pinHash == hashedPIN else {
            throw AuthError.invalidPIN
        }

        // Update last login on server
        try await SupabaseService.shared.updateUserLastLogin(userId: user.id)

        // Store session
        let session = Session(userId: user.id, userName: user.name, loginAt: Date())
        let sessionData = try JSONEncoder().encode(session)
        userDefaults.set(sessionData, forKey: sessionKey)

        currentUser = user
        isAuthenticated = true

        return true
    }

    func logout() {
        userDefaults.removeObject(forKey: sessionKey)
        currentUser = nil
        isAuthenticated = false
    }

    private func restoreSession() {
        guard let sessionData = userDefaults.data(forKey: sessionKey),
              let session = try? JSONDecoder().decode(Session.self, from: sessionData) else {
            return
        }

        // Session restored - user will be loaded when app fetches users
        // We store minimal info to avoid stale data
    }

    func restoreUserFromSession(users: [User]) {
        guard let sessionData = userDefaults.data(forKey: sessionKey),
              let session = try? JSONDecoder().decode(Session.self, from: sessionData),
              let user = users.first(where: { $0.id == session.userId }) else {
            return
        }

        currentUser = user
        isAuthenticated = true
    }

    // MARK: - Biometric Authentication

    var biometricsAvailable: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometricType: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)

        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "Biometrics"
        }
    }

    func authenticateWithBiometrics() async throws -> Bool {
        let context = LAContext()
        let reason = "Unlock Shared Todo List"

        return try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        )
    }
}

enum AuthError: LocalizedError {
    case invalidPIN
    case biometricsFailed
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .invalidPIN: return "Invalid PIN. Please try again."
        case .biometricsFailed: return "Biometric authentication failed."
        case .sessionExpired: return "Your session has expired. Please log in again."
        }
    }
}
```

### Sync Service (Offline Support)

```swift
import Foundation
import SwiftData
import Network

@Observable
final class SyncService {
    static let shared = SyncService()

    private(set) var isOnline = true
    private(set) var isSyncing = false
    private(set) var pendingOperationCount = 0

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")
    private var modelContext: ModelContext?

    private init() {
        startNetworkMonitoring()
    }

    func configure(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    // MARK: - Network Monitoring

    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                let wasOffline = !(self?.isOnline ?? true)
                self?.isOnline = path.status == .satisfied

                // Trigger sync when coming back online
                if wasOffline && path.status == .satisfied {
                    Task {
                        await self?.syncPendingOperations()
                    }
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    // MARK: - Offline Operations

    func queueOperation(type: SyncOperationType, entityType: String, entityId: String, payload: Data?) {
        guard let modelContext else { return }

        let operation = PendingOperation(
            type: type,
            entityType: entityType,
            entityId: entityId,
            payload: payload
        )

        modelContext.insert(operation)
        try? modelContext.save()

        updatePendingCount()
    }

    func syncPendingOperations() async {
        guard isOnline, let modelContext, !isSyncing else { return }

        isSyncing = true
        defer { isSyncing = false }

        let descriptor = FetchDescriptor<PendingOperation>(
            sortBy: [SortDescriptor(\.createdAt)]
        )

        guard let operations = try? modelContext.fetch(descriptor) else { return }

        for operation in operations {
            do {
                try await executeOperation(operation)
                modelContext.delete(operation)
                try? modelContext.save()
            } catch {
                operation.retryCount += 1
                operation.lastError = error.localizedDescription
                try? modelContext.save()

                // Skip after 3 retries
                if operation.retryCount >= 3 {
                    // Could notify user of failed sync
                    print("Operation failed after 3 retries: \(error)")
                }
            }
        }

        updatePendingCount()
    }

    private func executeOperation(_ operation: PendingOperation) async throws {
        guard let type = SyncOperationType(rawValue: operation.operationType) else { return }

        switch (type, operation.entityType) {
        case (.create, "todo"):
            guard let payload = operation.payload,
                  let todo = try? JSONDecoder().decode(Todo.self, from: payload) else { return }
            _ = try await SupabaseService.shared.createTodo(todo)

        case (.update, "todo"):
            guard let payload = operation.payload,
                  let todo = try? JSONDecoder().decode(Todo.self, from: payload) else { return }
            _ = try await SupabaseService.shared.updateTodo(todo)

        case (.delete, "todo"):
            try await SupabaseService.shared.deleteTodo(id: operation.entityId)

        default:
            break
        }
    }

    private func updatePendingCount() {
        guard let modelContext else { return }

        let descriptor = FetchDescriptor<PendingOperation>()
        pendingOperationCount = (try? modelContext.fetchCount(descriptor)) ?? 0
    }
}
```

### AI Service

```swift
import Foundation

@Observable
final class AIService {
    static let shared = AIService()

    private let baseURL: String

    private init() {
        baseURL = Config.apiBaseURL
    }

    // MARK: - Enhance Task

    struct EnhanceResponse: Codable {
        let success: Bool
        let enhanced: EnhancedTask?
        let error: String?
    }

    struct EnhancedTask: Codable {
        let text: String
        let priority: String?
        let dueDate: String?
        let assignedTo: String?
        let wasEnhanced: Bool
    }

    func enhanceTask(text: String, users: [String]) async throws -> EnhancedTask {
        let url = URL(string: "\(baseURL)/api/ai/enhance-task")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["text": text, "users": users] as [String: Any]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(EnhanceResponse.self, from: data)

        guard response.success, let enhanced = response.enhanced else {
            throw AIError.enhancementFailed(response.error ?? "Unknown error")
        }

        return enhanced
    }

    // MARK: - Smart Parse

    struct SmartParseResponse: Codable {
        let success: Bool
        let result: ParsedResult?
        let error: String?
    }

    struct ParsedResult: Codable {
        let mainTask: String
        let subtasks: [ParsedSubtask]
        let summary: String
        let wasComplex: Bool
    }

    struct ParsedSubtask: Codable {
        let text: String
        let priority: String
        let estimatedMinutes: Int?
    }

    func smartParse(text: String, users: [String]) async throws -> ParsedResult {
        let url = URL(string: "\(baseURL)/api/ai/smart-parse")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["text": text, "users": users] as [String: Any]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(SmartParseResponse.self, from: data)

        guard response.success, let result = response.result else {
            throw AIError.parseFailed(response.error ?? "Unknown error")
        }

        return result
    }
}

enum AIError: LocalizedError {
    case enhancementFailed(String)
    case parseFailed(String)
    case transcriptionFailed(String)

    var errorDescription: String? {
        switch self {
        case .enhancementFailed(let msg): return "Enhancement failed: \(msg)"
        case .parseFailed(let msg): return "Parse failed: \(msg)"
        case .transcriptionFailed(let msg): return "Transcription failed: \(msg)"
        }
    }
}
```

---

## Key Views

### Login View

```swift
import SwiftUI

struct LoginView: View {
    @Environment(AuthService.self) private var authService
    @State private var viewModel = LoginViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                // Logo & Title
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(.primaryBlue)

                    Text("Shared Todo List")
                        .font(.largeTitle.bold())

                    Text("Select your account to continue")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 60)

                // User Picker
                if viewModel.isLoading {
                    ProgressView()
                        .padding()
                } else {
                    UserPickerView(
                        users: viewModel.users,
                        selectedUser: $viewModel.selectedUser
                    )
                }

                // PIN Pad (shows when user selected)
                if viewModel.selectedUser != nil {
                    PINPadView(
                        pin: $viewModel.pin,
                        isLoading: viewModel.isAuthenticating,
                        error: viewModel.error,
                        onComplete: { viewModel.authenticate() }
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                Spacer()

                // Biometric Login (if available and user has session)
                if authService.biometricsAvailable && viewModel.canUseBiometrics {
                    Button {
                        viewModel.authenticateWithBiometrics()
                    } label: {
                        Label("Use \(authService.biometricType)", systemImage: biometricIcon)
                            .font(.headline)
                    }
                    .padding(.bottom, 32)
                }
            }
            .padding()
            .background(Color(.systemGroupedBackground))
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        CreateAccountView()
                    } label: {
                        Text("Create Account")
                    }
                }
            }
        }
        .task {
            await viewModel.loadUsers()
        }
    }

    private var biometricIcon: String {
        switch authService.biometricType {
        case "Face ID": return "faceid"
        case "Touch ID": return "touchid"
        default: return "lock.shield"
        }
    }
}
```

### Task List View

```swift
import SwiftUI

struct TaskListView: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var viewModel: TaskListViewModel

    init(currentUser: User) {
        _viewModel = State(initialValue: TaskListViewModel(currentUser: currentUser))
    }

    var body: some View {
        NavigationStack {
            Group {
                if sizeClass == .regular {
                    // iPad: Side-by-side list and detail
                    iPadLayout
                } else {
                    // iPhone: Standard list
                    iPhoneLayout
                }
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ConnectionIndicator(isOnline: viewModel.isOnline)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("View", selection: $viewModel.viewMode) {
                            Label("List", systemImage: "list.bullet").tag(ViewMode.list)
                            Label("Kanban", systemImage: "rectangle.split.3x1").tag(ViewMode.kanban)
                        }

                        Divider()

                        Menu("Sort By") {
                            Picker("Sort", selection: $viewModel.sortOption) {
                                ForEach(SortOption.allCases, id: \.self) { option in
                                    Text(option.displayName).tag(option)
                                }
                            }
                        }

                        Toggle("Show Completed", isOn: $viewModel.showCompleted)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.showAddTask = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .searchable(text: $viewModel.searchQuery, prompt: "Search tasks...")
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $viewModel.showAddTask) {
                AddTaskView(currentUser: viewModel.currentUser) { task in
                    viewModel.addTask(task)
                }
            }
            .sheet(item: $viewModel.selectedTask) { task in
                TaskDetailView(task: task) { updated in
                    viewModel.updateTask(updated)
                } onDelete: {
                    viewModel.deleteTask(task)
                }
            }
        }
        .task {
            await viewModel.loadTasks()
            viewModel.startRealtimeSubscription()
        }
    }

    // MARK: - iPhone Layout

    private var iPhoneLayout: some View {
        VStack(spacing: 0) {
            // Filter Bar
            TaskFilterBar(
                selectedFilter: $viewModel.quickFilter,
                counts: viewModel.filterCounts
            )

            // Bulk Action Bar (when selecting)
            if viewModel.isSelecting {
                BulkActionBar(
                    selectedCount: viewModel.selectedTasks.count,
                    onComplete: { viewModel.bulkComplete() },
                    onDelete: { viewModel.bulkDelete() },
                    onCancel: { viewModel.cancelSelection() }
                )
                .transition(.move(edge: .top))
            }

            // Task List or Kanban
            if viewModel.viewMode == .list {
                taskList
            } else {
                KanbanView(
                    todos: viewModel.filteredTodos,
                    onMove: { id, status in viewModel.moveTask(id: id, to: status) },
                    onTap: { viewModel.selectedTask = $0 }
                )
            }
        }
    }

    // MARK: - iPad Layout

    private var iPadLayout: some View {
        HStack(spacing: 0) {
            // Sidebar with filters and list
            VStack(spacing: 0) {
                TaskFilterBar(
                    selectedFilter: $viewModel.quickFilter,
                    counts: viewModel.filterCounts
                )

                taskList
            }
            .frame(width: 400)

            Divider()

            // Detail or Kanban view
            if viewModel.viewMode == .kanban {
                KanbanView(
                    todos: viewModel.filteredTodos,
                    onMove: { id, status in viewModel.moveTask(id: id, to: status) },
                    onTap: { viewModel.selectedTask = $0 }
                )
            } else if let selected = viewModel.selectedTask {
                TaskDetailView(task: selected) { updated in
                    viewModel.updateTask(updated)
                } onDelete: {
                    viewModel.deleteTask(selected)
                }
            } else {
                ContentUnavailableView(
                    "Select a Task",
                    systemImage: "checkmark.circle",
                    description: Text("Choose a task from the list to view details")
                )
            }
        }
    }

    // MARK: - Task List

    private var taskList: some View {
        Group {
            if viewModel.filteredTodos.isEmpty {
                ContentUnavailableView(
                    "No Tasks",
                    systemImage: "checkmark.circle",
                    description: Text("Add a task to get started")
                )
            } else {
                List(selection: $viewModel.selectedTaskIds) {
                    ForEach(viewModel.filteredTodos) { todo in
                        TaskRowView(
                            todo: todo,
                            onToggle: { viewModel.toggleComplete(todo) },
                            onTap: { viewModel.selectedTask = todo }
                        )
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                viewModel.deleteTask(todo)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                viewModel.toggleComplete(todo)
                            } label: {
                                Label(
                                    todo.completed ? "Undo" : "Complete",
                                    systemImage: todo.completed ? "arrow.uturn.backward" : "checkmark"
                                )
                            }
                            .tint(.green)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}
```

### Task Row View

```swift
import SwiftUI

struct TaskRowView: View {
    let todo: Todo
    let onToggle: () -> Void
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                // Checkbox
                Button(action: onToggle) {
                    Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(todo.completed ? .green : .secondary)
                }
                .buttonStyle(.plain)

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    // Task text
                    Text(todo.text)
                        .font(.body)
                        .strikethrough(todo.completed)
                        .foregroundStyle(todo.completed ? .secondary : .primary)
                        .lineLimit(2)

                    // Metadata row
                    HStack(spacing: 8) {
                        // Priority badge
                        PriorityBadge(priority: todo.priority)

                        // Due date
                        if let dueDate = todo.dueDate {
                            DueDateBadge(date: dueDate, isOverdue: todo.isOverdue)
                        }

                        // Subtask count
                        if todo.totalSubtaskCount > 0 {
                            HStack(spacing: 2) {
                                Image(systemName: "list.bullet")
                                    .font(.caption2)
                                Text("\(todo.completedSubtaskCount)/\(todo.totalSubtaskCount)")
                                    .font(.caption)
                            }
                            .foregroundStyle(.secondary)
                        }

                        Spacer()

                        // Assignee
                        if let assignee = todo.assignedTo {
                            Text(assignee)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Status indicator
                StatusBadge(status: todo.status)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }
}
```

---

## Push Notifications

### Server-Side (Supabase Edge Function)

```typescript
// supabase/functions/send-push-notification/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!
const BUNDLE_ID = 'com.yourcompany.sharedtodolist'

serve(async (req) => {
  const { type, payload, deviceTokens } = await req.json()

  // Generate JWT for APNs
  const jwt = await generateAPNsJWT()

  // Send to each device
  for (const token of deviceTokens) {
    const notification = buildNotification(type, payload)

    await fetch(`https://api.push.apple.com/3/device/${token}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body: JSON.stringify(notification),
    })
  }

  return new Response(JSON.stringify({ success: true }))
})

function buildNotification(type: string, payload: any) {
  switch (type) {
    case 'task_assigned':
      return {
        aps: {
          alert: {
            title: 'New Task Assigned',
            body: `${payload.assignedBy} assigned you: ${payload.taskText}`,
          },
          sound: 'default',
          badge: payload.badgeCount,
        },
        taskId: payload.taskId,
      }

    case 'task_due_soon':
      return {
        aps: {
          alert: {
            title: 'Task Due Soon',
            body: `"${payload.taskText}" is due in ${payload.timeUntil}`,
          },
          sound: 'default',
        },
        taskId: payload.taskId,
      }

    case 'task_overdue':
      return {
        aps: {
          alert: {
            title: 'Overdue Task',
            body: `"${payload.taskText}" is overdue`,
          },
          sound: 'default',
          'interruption-level': 'time-sensitive',
        },
        taskId: payload.taskId,
      }

    default:
      return {
        aps: {
          alert: payload.message,
          sound: 'default',
        },
      }
  }
}
```

### Client-Side (iOS)

```swift
// NotificationService.swift

import Foundation
import UserNotifications

@Observable
final class NotificationService: NSObject {
    static let shared = NotificationService()

    private(set) var isAuthorized = false
    private(set) var deviceToken: String?

    override private init() {
        super.init()
    }

    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            isAuthorized = granted

            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }

            return granted
        } catch {
            print("Notification authorization failed: \(error)")
            return false
        }
    }

    func handleDeviceToken(_ token: Data) {
        deviceToken = token.map { String(format: "%02.2hhx", $0) }.joined()

        // Register token with server
        Task {
            await registerTokenWithServer()
        }
    }

    private func registerTokenWithServer() async {
        guard let token = deviceToken,
              let userId = AuthService.shared.currentUser?.id else { return }

        // Store token in Supabase for this user
        try? await SupabaseService.shared.client
            .from("device_tokens")
            .upsert([
                "user_id": userId,
                "token": token,
                "platform": "ios",
                "updated_at": Date().ISO8601Format()
            ])
            .execute()
    }

    // Schedule local notification for due date reminder
    func scheduleDueReminder(for todo: Todo, reminderTime: TimeInterval = 3600) {
        guard let dueDate = todo.dueDate else { return }

        let content = UNMutableNotificationContent()
        content.title = "Task Due Soon"
        content.body = todo.text
        content.sound = .default
        content.userInfo = ["taskId": todo.id]

        let triggerDate = dueDate.addingTimeInterval(-reminderTime)
        guard triggerDate > Date() else { return }

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: triggerDate.timeIntervalSinceNow,
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: "due-\(todo.id)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }
}
```

---

## Widgets

```swift
// TodoWidgetBundle.swift

import WidgetKit
import SwiftUI

@main
struct TodoWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayCountWidget()
        UpcomingTasksWidget()
        TaskListWidget()
    }
}

// MARK: - Today Count Widget (Small)

struct TodayCountWidget: Widget {
    let kind = "TodayCountWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayCountProvider()) { entry in
            TodayCountWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Today's Tasks")
        .description("Shows task counts for today")
        .supportedFamilies([.systemSmall])
    }
}

struct TodayCountEntry: TimelineEntry {
    let date: Date
    let todoCount: Int
    let doneCount: Int
    let overdueCount: Int
}

struct TodayCountProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayCountEntry {
        TodayCountEntry(date: Date(), todoCount: 5, doneCount: 3, overdueCount: 1)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayCountEntry) -> Void) {
        // Fetch from shared container
        let entry = TodayCountEntry(date: Date(), todoCount: 5, doneCount: 3, overdueCount: 1)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayCountEntry>) -> Void) {
        Task {
            // Fetch real data from shared UserDefaults or Supabase
            let todos = await fetchTodosForWidget()

            let todoCount = todos.filter { !$0.completed && $0.status != .done }.count
            let doneCount = todos.filter { $0.completed || $0.status == .done }.count
            let overdueCount = todos.filter { $0.isOverdue }.count

            let entry = TodayCountEntry(
                date: Date(),
                todoCount: todoCount,
                doneCount: doneCount,
                overdueCount: overdueCount
            )

            // Refresh every 15 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }

    private func fetchTodosForWidget() async -> [Todo] {
        // Use shared container to access cached data
        // or make lightweight Supabase call
        return []
    }
}

struct TodayCountWidgetView: View {
    let entry: TodayCountEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.blue)
                Text("Tasks")
                    .font(.headline)
            }

            Spacer()

            HStack(spacing: 16) {
                VStack {
                    Text("\(entry.todoCount)")
                        .font(.title.bold())
                    Text("To Do")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                VStack {
                    Text("\(entry.doneCount)")
                        .font(.title.bold())
                        .foregroundStyle(.green)
                    Text("Done")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if entry.overdueCount > 0 {
                Text("\(entry.overdueCount) overdue")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding()
    }
}
```

---

## App Store Requirements

### Required Assets

| Asset | Size | Notes |
|-------|------|-------|
| App Icon | 1024x1024 | No transparency, no rounded corners |
| Screenshots (iPhone) | 6.7", 6.5", 5.5" | At least 3 each |
| Screenshots (iPad) | 12.9" | At least 3 |
| App Preview Video | Optional | 15-30 seconds |

### Info.plist Keys

```xml
<!-- Privacy descriptions -->
<key>NSMicrophoneUsageDescription</key>
<string>Used for voice input when creating tasks</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Used to transcribe voice input into tasks</string>

<key>NSFaceIDUsageDescription</key>
<string>Use Face ID to quickly unlock the app</string>

<key>NSUserNotificationsUsageDescription</key>
<string>Receive reminders for due tasks and updates from your team</string>

<!-- Background modes -->
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>remote-notification</string>
</array>
```

### App Store Metadata

```yaml
Name: Shared Todo List
Subtitle: Family & Team Tasks
Category: Productivity
Age Rating: 4+
Price: Free

Keywords:
  - todo
  - tasks
  - family
  - shared
  - checklist
  - reminders
  - productivity
  - team
  - collaboration

Description: |
  Shared Todo List is the simplest way to manage tasks with your
  family, roommates, or small team.

  FEATURES:
  • Real-time sync - Changes appear instantly for everyone
  • Offline support - Keep working without internet
  • Smart AI - Enhance tasks and break them into subtasks
  • Voice input - Speak your tasks naturally
  • Due dates & reminders - Never miss a deadline
  • Priority levels - Focus on what matters
  • Subtasks - Break down complex tasks
  • Recurring tasks - Daily, weekly, or monthly

  PERFECT FOR:
  • Household chores
  • Grocery lists
  • Family projects
  • Small team coordination

  Works seamlessly with the Shared Todo List web app.

Privacy Policy URL: https://your-domain.com/privacy
Support URL: https://your-domain.com/support
```

---

## Development Milestones

### Phase 1: Foundation (MVP)
- [ ] Xcode project setup with SwiftUI
- [ ] SwiftData configuration
- [ ] Supabase SDK integration
- [ ] Data models (Todo, User, Subtask)
- [ ] Auth service with PIN hashing
- [ ] Login flow (user picker + PIN pad)
- [ ] Basic task list view
- [ ] Create/Edit/Delete tasks
- [ ] Real-time subscriptions
- [ ] Pull-to-refresh

### Phase 2: Feature Complete
- [ ] All filters (My Tasks, Due Today, Overdue, Urgent)
- [ ] All sort options
- [ ] Search functionality
- [ ] Subtasks UI
- [ ] Task detail/edit view
- [ ] Status picker
- [ ] Priority picker
- [ ] Due date picker
- [ ] Assignee picker
- [ ] Recurrence support
- [ ] Bulk actions (multi-select)

### Phase 3: AI & Voice
- [ ] AI enhance task button
- [ ] Smart parse modal
- [ ] Voice input (Speech framework)
- [ ] AI service integration

### Phase 4: Offline & Sync
- [ ] SwiftData caching
- [ ] Network monitor
- [ ] Offline operation queue
- [ ] Sync engine
- [ ] Conflict resolution
- [ ] Sync status indicator

### Phase 5: Notifications
- [ ] Push notification setup (APNs)
- [ ] Device token registration
- [ ] Supabase Edge Function for sending
- [ ] Database trigger for task assignment
- [ ] Local due date reminders
- [ ] Notification settings UI

### Phase 6: iPad & Polish
- [ ] iPad adaptive layout
- [ ] Kanban view (drag & drop)
- [ ] Biometric authentication
- [ ] Haptic feedback
- [ ] Animations & transitions
- [ ] Accessibility (VoiceOver, Dynamic Type)
- [ ] Dark mode (automatic)

### Phase 7: Extensions
- [ ] Home screen widgets (3 sizes)
- [ ] Share extension
- [ ] Siri shortcuts / App Intents
- [ ] Spotlight indexing

### Phase 8: App Store
- [ ] App icons (all sizes)
- [ ] Screenshots (iPhone + iPad)
- [ ] App Store metadata
- [ ] Privacy policy
- [ ] TestFlight beta
- [ ] App Store submission

---

## Environment Configuration

### Config.swift

```swift
import Foundation

enum Config {
    // Supabase
    static let supabaseURL = "https://your-project.supabase.co"
    static let supabaseAnonKey = "your-anon-key"

    // API (for AI endpoints)
    static let apiBaseURL = "https://shared-todo-list-production.up.railway.app"

    // App
    static let appGroupIdentifier = "group.com.yourcompany.sharedtodolist"
}
```

### Signing & Capabilities

Required capabilities in Xcode:
- Push Notifications
- Background Modes (Background fetch, Remote notifications)
- App Groups (for widget data sharing)
- Keychain Sharing (for secure storage)

---

## Estimated Effort

| Phase | Complexity | Notes |
|-------|------------|-------|
| Phase 1 | Medium | Core infrastructure |
| Phase 2 | Medium | Feature implementation |
| Phase 3 | Low-Medium | API calls + Speech framework |
| Phase 4 | High | Offline sync is complex |
| Phase 5 | Medium-High | Server + client setup |
| Phase 6 | Medium | iPad layouts, polish |
| Phase 7 | Medium | Widgets, extensions |
| Phase 8 | Low | Prep and submission |

---

## Next Steps

1. **Create Xcode project** with the structure above
2. **Set up Supabase iOS SDK** and test connection
3. **Implement data models** and SwiftData schema
4. **Build auth flow** (matches web app PIN system)
5. **Create task list view** with real-time sync
6. **Iterate through phases** based on priority

Ready to start building? Let me know which phase or component you'd like to tackle first!
