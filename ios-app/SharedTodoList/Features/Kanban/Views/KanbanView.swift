import SwiftUI

struct KanbanView: View {
    let currentUser: User
    let users: [User]

    @Environment(SyncService.self) private var syncService
    @Environment(\.horizontalSizeClass) private var sizeClass

    @State private var todos: [Todo] = []
    @State private var isLoading = true
    @State private var selectedTask: Todo?
    @State private var draggedTask: Todo?

    var body: some View {
        Group {
            if sizeClass == .regular {
                // iPad: Three columns side by side
                iPadLayout
            } else {
                // iPhone: Horizontally scrollable columns
                iPhoneLayout
            }
        }
        .task {
            await loadTasks()
        }
        .sheet(item: $selectedTask) { task in
            TaskDetailView(
                task: task,
                currentUser: currentUser,
                users: users.map { $0.name }
            ) { updated in
                updateTask(updated)
            } onDelete: {
                deleteTask(task)
            }
        }
    }

    // MARK: - iPad Layout

    private var iPadLayout: some View {
        HStack(spacing: 16) {
            ForEach(TodoStatus.allCases) { status in
                KanbanColumn(
                    status: status,
                    todos: todosForStatus(status),
                    onTap: { selectedTask = $0 },
                    onMove: { task, newStatus in
                        moveTask(task, to: newStatus)
                    },
                    draggedTask: $draggedTask
                )
            }
        }
        .padding()
    }

    // MARK: - iPhone Layout

    private var iPhoneLayout: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(TodoStatus.allCases) { status in
                    KanbanColumn(
                        status: status,
                        todos: todosForStatus(status),
                        onTap: { selectedTask = $0 },
                        onMove: { task, newStatus in
                            moveTask(task, to: newStatus)
                        },
                        draggedTask: $draggedTask
                    )
                    .frame(width: UIScreen.main.bounds.width - 64)
                }
            }
            .padding()
        }
        .scrollTargetBehavior(.paging)
    }

    // MARK: - Helpers

    private func todosForStatus(_ status: TodoStatus) -> [Todo] {
        var filtered = todos.filter { $0.status == status }

        // Role-based filtering
        if !currentUser.isAdmin {
            filtered = filtered.filter { todo in
                todo.createdBy == currentUser.name || todo.assignedTo == currentUser.name
            }
        }

        return filtered.sorted { $0.priority < $1.priority }
    }

    // MARK: - Data Loading

    private func loadTasks() async {
        isLoading = true

        do {
            todos = try await SupabaseService.shared.fetchTodos()
        } catch {
            if !syncService.isOnline {
                todos = syncService.getCachedTodos()
            }
        }

        isLoading = false
    }

    // MARK: - Actions

    private func moveTask(_ task: Todo, to status: TodoStatus) {
        let updated = task.withStatus(status)
        updateTask(updated)
    }

    private func updateTask(_ task: Todo) {
        if let index = todos.firstIndex(where: { $0.id == task.id }) {
            todos[index] = task
        }

        Task {
            do {
                _ = try await SupabaseService.shared.updateTodo(task)
            } catch {
                syncService.queueUpdate(task)
            }
        }
    }

    private func deleteTask(_ task: Todo) {
        todos.removeAll { $0.id == task.id }

        Task {
            do {
                try await SupabaseService.shared.deleteTodo(id: task.id)
            } catch {
                syncService.queueDelete(todoId: task.id)
            }
        }
    }
}

// MARK: - Kanban Column

struct KanbanColumn: View {
    let status: TodoStatus
    let todos: [Todo]
    let onTap: (Todo) -> Void
    let onMove: (Todo, TodoStatus) -> Void
    @Binding var draggedTask: Todo?

    @State private var isTargeted = false

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Circle()
                    .fill(status.color)
                    .frame(width: 12, height: 12)

                Text(status.displayName)
                    .font(.headline)

                Spacer()

                Text("\(todos.count)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
            }
            .padding(.horizontal)

            // Cards
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(todos) { todo in
                        KanbanCard(todo: todo, onTap: { onTap(todo) })
                            .draggable(todo.id) {
                                KanbanCard(todo: todo, onTap: {})
                                    .frame(width: 280)
                                    .opacity(0.8)
                                    .onAppear { draggedTask = todo }
                            }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            if isTargeted {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(status.color, lineWidth: 3)
            }
        }
        .dropDestination(for: String.self) { items, _ in
            guard let id = items.first,
                  let task = draggedTask,
                  task.id == id,
                  task.status != status else {
                return false
            }

            onMove(task, status)
            draggedTask = nil
            return true
        } isTargeted: { targeted in
            isTargeted = targeted
        }
    }
}

// MARK: - Kanban Card

struct KanbanCard: View {
    let todo: Todo
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                // Task text
                Text(todo.text)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                // Metadata
                HStack(spacing: 8) {
                    PriorityBadge(priority: todo.priority, style: .compact)

                    if let dueDate = todo.dueDate {
                        DueDateBadge(
                            date: dueDate,
                            isOverdue: todo.isOverdue,
                            isDueToday: todo.isDueToday
                        )
                    }

                    Spacer()

                    // Subtask progress
                    if todo.hasSubtasks {
                        HStack(spacing: 4) {
                            Image(systemName: "list.bullet")
                                .font(.caption2)
                            Text("\(todo.completedSubtaskCount)/\(todo.totalSubtaskCount)")
                                .font(.caption2)
                        }
                        .foregroundStyle(.secondary)
                    }
                }

                // Assignee
                if let assignee = todo.assignedTo {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 20, height: 20)
                            .overlay {
                                Text(String(assignee.prefix(1)).uppercased())
                                    .font(.caption2.bold())
                                    .foregroundStyle(.white)
                            }

                        Text(assignee)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        KanbanView(currentUser: .sample, users: User.samples)
            .environment(SyncService.shared)
            .navigationTitle("Board")
    }
}
