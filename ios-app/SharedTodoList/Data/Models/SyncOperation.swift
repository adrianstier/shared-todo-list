import Foundation
import SwiftData

// MARK: - Sync Operation Type

enum SyncOperationType: String, Codable {
    case create
    case update
    case delete
}

// MARK: - Entity Type

enum SyncEntityType: String, Codable {
    case todo
    case user
}

// MARK: - Pending Operation (SwiftData Model)

@Model
final class PendingOperation {
    @Attribute(.unique) var id: String
    var operationType: String
    var entityType: String
    var entityId: String
    var payload: Data?
    var createdAt: Date
    var retryCount: Int
    var lastError: String?
    var lastAttemptAt: Date?

    init(
        type: SyncOperationType,
        entityType: SyncEntityType,
        entityId: String,
        payload: Data? = nil
    ) {
        self.id = UUID().uuidString
        self.operationType = type.rawValue
        self.entityType = entityType.rawValue
        self.entityId = entityId
        self.payload = payload
        self.createdAt = Date()
        self.retryCount = 0
    }

    var operation: SyncOperationType? {
        SyncOperationType(rawValue: operationType)
    }

    var entity: SyncEntityType? {
        SyncEntityType(rawValue: entityType)
    }

    var canRetry: Bool {
        retryCount < 5
    }

    var shouldBackoff: Bool {
        guard let lastAttempt = lastAttemptAt else { return false }
        let backoffSeconds = pow(2.0, Double(retryCount)) // Exponential backoff
        return Date().timeIntervalSince(lastAttempt) < backoffSeconds
    }

    func recordAttempt(error: Error?) {
        retryCount += 1
        lastAttemptAt = Date()
        lastError = error?.localizedDescription
    }

    func decodeTodo() -> Todo? {
        guard let data = payload else { return nil }
        return try? JSONDecoder().decode(Todo.self, from: data)
    }
}

// MARK: - Sync Status

enum SyncStatus: Equatable {
    case idle
    case syncing
    case offline
    case error(String)

    var displayName: String {
        switch self {
        case .idle: return "Synced"
        case .syncing: return "Syncing..."
        case .offline: return "Offline"
        case .error(let msg): return "Error: \(msg)"
        }
    }

    var icon: String {
        switch self {
        case .idle: return "checkmark.circle.fill"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .offline: return "wifi.slash"
        case .error: return "exclamationmark.triangle.fill"
        }
    }

    var isOnline: Bool {
        switch self {
        case .offline: return false
        default: return true
        }
    }
}

// MARK: - Conflict Resolution

enum ConflictResolution {
    case useLocal
    case useRemote
    case merge
}

struct SyncConflict {
    let localTodo: Todo
    let remoteTodo: Todo
    let conflictType: ConflictType

    enum ConflictType {
        case bothModified
        case localDeletedRemoteModified
        case localModifiedRemoteDeleted
    }
}
