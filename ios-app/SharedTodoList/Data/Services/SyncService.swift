import Foundation
import SwiftData
import Network

/// Service for managing offline sync
@Observable
final class SyncService {
    static let shared = SyncService()

    // MARK: - Properties

    private(set) var isOnline = true
    private(set) var isSyncing = false
    private(set) var pendingOperationCount = 0
    private(set) var lastSyncTime: Date?
    private(set) var syncStatus: SyncStatus = .idle

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "NetworkMonitor")
    private var modelContext: ModelContext?

    // MARK: - Initialization

    private init() {
        startNetworkMonitoring()
    }

    /// Configure with SwiftData model context
    func configure(modelContext: ModelContext) {
        self.modelContext = modelContext
        updatePendingCount()
    }

    // MARK: - Network Monitoring

    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let wasOffline = !(self?.isOnline ?? true)
                self?.isOnline = path.status == .satisfied

                if path.status == .satisfied {
                    self?.syncStatus = .idle

                    // Trigger sync when coming back online
                    if wasOffline {
                        await self?.syncPendingOperations()
                    }
                } else {
                    self?.syncStatus = .offline
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    // MARK: - Queue Operations

    /// Queue a create operation for offline sync
    func queueCreate(_ todo: Todo) {
        guard let modelContext, Config.offlineModeEnabled else { return }

        // Also cache the todo locally
        let cached = CachedTodo(from: todo)
        cached.markForSync(operation: "create")
        modelContext.insert(cached)

        // Create pending operation
        let payload = try? JSONEncoder().encode(todo)
        let operation = PendingOperation(
            type: .create,
            entityType: .todo,
            entityId: todo.id,
            payload: payload
        )
        modelContext.insert(operation)

        try? modelContext.save()
        updatePendingCount()

        if Config.logSyncOperations {
            print("[Sync] Queued CREATE for todo: \(todo.id)")
        }
    }

    /// Queue an update operation for offline sync
    func queueUpdate(_ todo: Todo) {
        guard let modelContext, Config.offlineModeEnabled else { return }

        // Update local cache
        let descriptor = FetchDescriptor<CachedTodo>(
            predicate: #Predicate { $0.id == todo.id }
        )

        if let cached = try? modelContext.fetch(descriptor).first {
            cached.update(from: todo)
            cached.markForSync(operation: "update")
        }

        // Create pending operation (or update existing)
        let payload = try? JSONEncoder().encode(todo)
        let operation = PendingOperation(
            type: .update,
            entityType: .todo,
            entityId: todo.id,
            payload: payload
        )
        modelContext.insert(operation)

        try? modelContext.save()
        updatePendingCount()

        if Config.logSyncOperations {
            print("[Sync] Queued UPDATE for todo: \(todo.id)")
        }
    }

    /// Queue a delete operation for offline sync
    func queueDelete(todoId: String) {
        guard let modelContext, Config.offlineModeEnabled else { return }

        // Mark local cache as deleted
        let descriptor = FetchDescriptor<CachedTodo>(
            predicate: #Predicate { $0.id == todoId }
        )

        if let cached = try? modelContext.fetch(descriptor).first {
            cached.locallyDeleted = true
            cached.markForSync(operation: "delete")
        }

        // Create pending operation
        let operation = PendingOperation(
            type: .delete,
            entityType: .todo,
            entityId: todoId
        )
        modelContext.insert(operation)

        try? modelContext.save()
        updatePendingCount()

        if Config.logSyncOperations {
            print("[Sync] Queued DELETE for todo: \(todoId)")
        }
    }

    // MARK: - Sync Execution

    /// Sync all pending operations to the server
    func syncPendingOperations() async {
        guard isOnline, let modelContext, !isSyncing else { return }

        await MainActor.run {
            isSyncing = true
            syncStatus = .syncing
        }

        defer {
            Task { @MainActor in
                isSyncing = false
                syncStatus = isOnline ? .idle : .offline
                lastSyncTime = Date()
            }
        }

        // Fetch pending operations sorted by creation time
        let descriptor = FetchDescriptor<PendingOperation>(
            sortBy: [SortDescriptor(\.createdAt)]
        )

        guard let operations = try? modelContext.fetch(descriptor) else { return }

        if Config.logSyncOperations {
            print("[Sync] Starting sync of \(operations.count) operations")
        }

        for operation in operations {
            // Skip if should backoff
            if operation.shouldBackoff {
                continue
            }

            do {
                try await executeOperation(operation)

                // Success - delete the operation
                modelContext.delete(operation)

                if Config.logSyncOperations {
                    print("[Sync] Completed \(operation.operationType) for \(operation.entityId)")
                }
            } catch {
                operation.recordAttempt(error: error)

                if !operation.canRetry {
                    // Max retries exceeded - remove operation and notify
                    modelContext.delete(operation)
                    await MainActor.run {
                        syncStatus = .error("Failed to sync: \(operation.entityId)")
                    }

                    if Config.logSyncOperations {
                        print("[Sync] FAILED after \(operation.retryCount) retries: \(operation.entityId)")
                    }
                }
            }

            try? modelContext.save()
        }

        updatePendingCount()

        if Config.logSyncOperations {
            print("[Sync] Sync complete. Pending: \(pendingOperationCount)")
        }
    }

    private func executeOperation(_ operation: PendingOperation) async throws {
        guard let type = operation.operation,
              let entity = operation.entity else { return }

        switch (type, entity) {
        case (.create, .todo):
            guard let todo = operation.decodeTodo() else { return }
            _ = try await SupabaseService.shared.createTodo(todo)

        case (.update, .todo):
            guard let todo = operation.decodeTodo() else { return }
            _ = try await SupabaseService.shared.updateTodo(todo)

        case (.delete, .todo):
            try await SupabaseService.shared.deleteTodo(id: operation.entityId)

        default:
            break
        }
    }

    // MARK: - Cache Management

    /// Cache todos from server
    func cacheTodos(_ todos: [Todo]) {
        guard let modelContext, Config.offlineModeEnabled else { return }

        // Get existing cached IDs
        let descriptor = FetchDescriptor<CachedTodo>()
        let existing = (try? modelContext.fetch(descriptor)) ?? []
        let existingIds = Set(existing.map { $0.id })
        let newIds = Set(todos.map { $0.id })

        // Update or insert
        for todo in todos {
            if let cached = existing.first(where: { $0.id == todo.id }) {
                // Only update if not pending sync
                if !cached.needsSync {
                    cached.update(from: todo)
                }
            } else {
                let cached = CachedTodo(from: todo)
                modelContext.insert(cached)
            }
        }

        // Remove deleted (except locally modified)
        for cached in existing {
            if !newIds.contains(cached.id) && !cached.needsSync {
                modelContext.delete(cached)
            }
        }

        try? modelContext.save()
    }

    /// Get cached todos
    func getCachedTodos() -> [Todo] {
        guard let modelContext else { return [] }

        let descriptor = FetchDescriptor<CachedTodo>(
            predicate: #Predicate { !$0.locallyDeleted }
        )

        guard let cached = try? modelContext.fetch(descriptor) else { return [] }
        return cached.map { $0.toTodo() }
    }

    /// Clear all cached data
    func clearCache() {
        guard let modelContext else { return }

        // Delete all cached todos
        let todoDescriptor = FetchDescriptor<CachedTodo>()
        if let todos = try? modelContext.fetch(todoDescriptor) {
            for todo in todos {
                modelContext.delete(todo)
            }
        }

        // Delete all pending operations
        let opDescriptor = FetchDescriptor<PendingOperation>()
        if let operations = try? modelContext.fetch(opDescriptor) {
            for op in operations {
                modelContext.delete(op)
            }
        }

        try? modelContext.save()
        updatePendingCount()
    }

    // MARK: - Helpers

    private func updatePendingCount() {
        guard let modelContext else {
            pendingOperationCount = 0
            return
        }

        let descriptor = FetchDescriptor<PendingOperation>()
        pendingOperationCount = (try? modelContext.fetchCount(descriptor)) ?? 0
    }
}
