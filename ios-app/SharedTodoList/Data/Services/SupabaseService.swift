import Foundation
import Supabase

/// Service for all Supabase operations
@Observable
final class SupabaseService {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private var todosChannel: RealtimeChannelV2?

    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }

    // MARK: - Todos

    /// Fetch all todos from the database
    func fetchTodos() async throws -> [Todo] {
        let response: [Todo] = try await client
            .from("todos")
            .select()
            .order("created_at", ascending: false)
            .execute()
            .value

        return response
    }

    /// Fetch todos for a specific user (respecting role-based visibility)
    func fetchTodos(for user: User) async throws -> [Todo] {
        let allTodos = try await fetchTodos()

        // Admins see all tasks
        if user.isAdmin {
            return allTodos
        }

        // Members only see tasks they created or are assigned to
        return allTodos.filter { todo in
            todo.createdBy == user.name || todo.assignedTo == user.name
        }
    }

    /// Create a new todo
    func createTodo(_ todo: Todo) async throws -> Todo {
        let response: Todo = try await client
            .from("todos")
            .insert(todo)
            .select()
            .single()
            .execute()
            .value

        return response
    }

    /// Update an existing todo
    func updateTodo(_ todo: Todo) async throws -> Todo {
        let response: Todo = try await client
            .from("todos")
            .update(todo)
            .eq("id", value: todo.id)
            .select()
            .single()
            .execute()
            .value

        return response
    }

    /// Delete a todo by ID
    func deleteTodo(id: String) async throws {
        try await client
            .from("todos")
            .delete()
            .eq("id", value: id)
            .execute()
    }

    /// Bulk delete todos
    func deleteTodos(ids: [String]) async throws {
        try await client
            .from("todos")
            .delete()
            .in("id", values: ids)
            .execute()
    }

    /// Bulk update todos (e.g., mark complete, assign)
    func updateTodos(ids: [String], updates: [String: Any]) async throws {
        try await client
            .from("todos")
            .update(updates)
            .in("id", values: ids)
            .execute()
    }

    // MARK: - Users

    /// Fetch all users
    func fetchUsers() async throws -> [User] {
        let response: [User] = try await client
            .from("users")
            .select()
            .execute()
            .value

        return response
    }

    /// Fetch a single user by ID
    func fetchUser(id: String) async throws -> User {
        let response: User = try await client
            .from("users")
            .select()
            .eq("id", value: id)
            .single()
            .execute()
            .value

        return response
    }

    /// Fetch a user by name
    func fetchUser(name: String) async throws -> User? {
        let response: [User] = try await client
            .from("users")
            .select()
            .eq("name", value: name)
            .execute()
            .value

        return response.first
    }

    /// Create a new user
    func createUser(_ user: User) async throws -> User {
        let response: User = try await client
            .from("users")
            .insert(user)
            .select()
            .single()
            .execute()
            .value

        return response
    }

    /// Update user's last login
    func updateUserLastLogin(userId: String) async throws {
        try await client
            .from("users")
            .update(["last_login": ISO8601DateFormatter().string(from: Date())])
            .eq("id", value: userId)
            .execute()
    }

    /// Update user's streak
    func updateUserStreak(userId: String, streakCount: Int, streakDate: Date) async throws {
        try await client
            .from("users")
            .update([
                "streak_count": streakCount,
                "streak_last_date": ISO8601DateFormatter().string(from: streakDate)
            ])
            .eq("id", value: userId)
            .execute()
    }

    // MARK: - Device Tokens (for Push Notifications)

    /// Register device token for push notifications
    func registerDeviceToken(userId: String, token: String) async throws {
        try await client
            .from("device_tokens")
            .upsert([
                "user_id": userId,
                "token": token,
                "platform": "ios",
                "updated_at": ISO8601DateFormatter().string(from: Date())
            ])
            .execute()
    }

    /// Remove device token
    func removeDeviceToken(token: String) async throws {
        try await client
            .from("device_tokens")
            .delete()
            .eq("token", value: token)
            .execute()
    }

    // MARK: - Real-time Subscriptions

    /// Subscribe to todo changes
    func subscribeTodos(
        onInsert: @escaping (Todo) -> Void,
        onUpdate: @escaping (Todo) -> Void,
        onDelete: @escaping (String) -> Void
    ) async -> RealtimeChannelV2 {
        // Unsubscribe from existing channel if any
        if let existingChannel = todosChannel {
            await existingChannel.unsubscribe()
        }

        let channel = client.channel("todos-channel")

        let insertSubscription = channel.onPostgresChange(
            InsertAction.self,
            schema: "public",
            table: "todos"
        ) { insert in
            if let todo: Todo = try? insert.decodeRecord(decoder: JSONDecoder.supabaseDecoder) {
                Task { @MainActor in
                    onInsert(todo)
                }
            }
        }

        let updateSubscription = channel.onPostgresChange(
            UpdateAction.self,
            schema: "public",
            table: "todos"
        ) { update in
            if let todo: Todo = try? update.decodeRecord(decoder: JSONDecoder.supabaseDecoder) {
                Task { @MainActor in
                    onUpdate(todo)
                }
            }
        }

        let deleteSubscription = channel.onPostgresChange(
            DeleteAction.self,
            schema: "public",
            table: "todos"
        ) { delete in
            if let id = delete.oldRecord["id"]?.stringValue {
                Task { @MainActor in
                    onDelete(id)
                }
            }
        }

        await channel.subscribe()

        todosChannel = channel
        return channel
    }

    /// Unsubscribe from all channels
    func unsubscribeAll() async {
        if let channel = todosChannel {
            await channel.unsubscribe()
            todosChannel = nil
        }
    }

    // MARK: - Connection Status

    /// Check if we can reach Supabase
    func checkConnection() async -> Bool {
        do {
            // Simple health check - try to fetch count
            let _: Int = try await client
                .from("todos")
                .select("id", head: true, count: .exact)
                .execute()
                .count ?? 0
            return true
        } catch {
            return false
        }
    }
}

// MARK: - JSON Decoder Extension

extension JSONDecoder {
    static var supabaseDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try ISO8601 with fractional seconds
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateString) {
                return date
            }

            // Try ISO8601 without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }
        return decoder
    }
}
