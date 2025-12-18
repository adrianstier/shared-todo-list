import SwiftUI
import Supabase

// MARK: - Quick Filter

enum QuickFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case myTasks = "My Tasks"
    case dueToday = "Due Today"
    case overdue = "Overdue"
    case urgent = "Urgent"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .all: return "tray"
        case .myTasks: return "person"
        case .dueToday: return "calendar"
        case .overdue: return "exclamationmark.circle"
        case .urgent: return "flame"
        }
    }
}

// MARK: - Sort Option

enum SortOption: String, CaseIterable, Identifiable {
    case created = "Created"
    case dueDate = "Due Date"
    case priority = "Priority"
    case alphabetical = "A-Z"

    var id: String { rawValue }
}

// MARK: - Task List View

struct TaskListView: View {
    let currentUser: User
    let users: [User]

    @Environment(SyncService.self) private var syncService

    @State private var todos: [Todo] = []
    @State private var isLoading = true
    @State private var error: Error?

    @State private var searchQuery = ""
    @State private var quickFilter: QuickFilter = .all
    @State private var sortOption: SortOption = .created
    @State private var showCompleted = false

    @State private var selectedTodos: Set<String> = []
    @State private var isSelecting = false

    @State private var showAddTask = false
    @State private var selectedTask: Todo?

    @State private var realtimeChannel: RealtimeChannelV2?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Connection status bar (if offline or syncing)
                connectionStatusBar

                // Filter bar
                filterBar

                // Bulk action bar (when selecting)
                if isSelecting {
                    bulkActionBar
                        .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Task list
                taskList
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if isSelecting {
                        Button("Cancel") {
                            withAnimation {
                                isSelecting = false
                                selectedTodos.removeAll()
                            }
                        }
                    } else {
                        Button {
                            withAnimation {
                                isSelecting = true
                            }
                        } label: {
                            Image(systemName: "checkmark.circle")
                        }
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        // Sort options
                        Menu("Sort By") {
                            Picker("Sort", selection: $sortOption) {
                                ForEach(SortOption.allCases) { option in
                                    Text(option.rawValue).tag(option)
                                }
                            }
                        }

                        Divider()

                        Toggle("Show Completed", isOn: $showCompleted)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddTask = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .searchable(text: $searchQuery, prompt: "Search tasks...")
            .refreshable {
                await loadTasks()
            }
            .sheet(isPresented: $showAddTask) {
                AddTaskView(
                    currentUser: currentUser,
                    users: users.map { $0.name }
                ) { newTask in
                    addTask(newTask)
                }
            }
            .sheet(item: $selectedTask) { task in
                TaskDetailView(
                    task: task,
                    currentUser: currentUser,
                    users: users.map { $0.name }
                ) { updatedTask in
                    updateTask(updatedTask)
                } onDelete: {
                    deleteTask(task)
                }
            }
        }
        .task {
            await loadTasks()
            await startRealtimeSubscription()
        }
        .onDisappear {
            Task {
                await realtimeChannel?.unsubscribe()
            }
        }
    }

    // MARK: - Connection Status Bar

    @ViewBuilder
    private var connectionStatusBar: some View {
        if !syncService.isOnline {
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                Text("Offline - Changes will sync when online")
                Spacer()
                if syncService.pendingOperationCount > 0 {
                    Text("\(syncService.pendingOperationCount) pending")
                        .font(.caption)
                }
            }
            .font(.caption)
            .foregroundStyle(.white)
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.orange)
        } else if syncService.isSyncing {
            HStack(spacing: 8) {
                ProgressView()
                    .tint(.white)
                    .scaleEffect(0.8)
                Text("Syncing...")
            }
            .font(.caption)
            .foregroundStyle(.white)
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.blue)
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(QuickFilter.allCases) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        icon: filter.icon,
                        count: countForFilter(filter),
                        isSelected: quickFilter == filter,
                        onTap: {
                            withAnimation(.spring(response: 0.3)) {
                                quickFilter = filter
                            }
                        }
                    )
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.secondarySystemGroupedBackground))
    }

    // MARK: - Bulk Action Bar

    private var bulkActionBar: some View {
        HStack(spacing: 16) {
            Text("\(selectedTodos.count) selected")
                .font(.subheadline.weight(.medium))

            Spacer()

            Button {
                bulkComplete()
            } label: {
                Image(systemName: "checkmark.circle")
            }
            .disabled(selectedTodos.isEmpty)

            Button {
                bulkAssign()
            } label: {
                Image(systemName: "person.badge.plus")
            }
            .disabled(selectedTodos.isEmpty)

            Button(role: .destructive) {
                bulkDelete()
            } label: {
                Image(systemName: "trash")
            }
            .disabled(selectedTodos.isEmpty)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
    }

    // MARK: - Task List

    private var taskList: some View {
        Group {
            if isLoading && todos.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filteredTodos.isEmpty {
                emptyState
            } else {
                List(selection: isSelecting ? $selectedTodos : .constant(Set<String>())) {
                    ForEach(filteredTodos) { todo in
                        TaskRowView(
                            todo: todo,
                            onToggle: { toggleComplete(todo) },
                            onTap: {
                                if isSelecting {
                                    toggleSelection(todo.id)
                                } else {
                                    selectedTask = todo
                                }
                            }
                        )
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                deleteTask(todo)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            Button {
                                toggleComplete(todo)
                            } label: {
                                Label(
                                    todo.completed ? "Undo" : "Complete",
                                    systemImage: todo.completed ? "arrow.uturn.backward" : "checkmark"
                                )
                            }
                            .tint(.green)
                        }
                        .tag(todo.id)
                    }
                }
                .listStyle(.plain)
                .environment(\.editMode, isSelecting ? .constant(.active) : .constant(.inactive))
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label(emptyStateTitle, systemImage: emptyStateIcon)
        } description: {
            Text(emptyStateMessage)
        } actions: {
            if quickFilter == .all && searchQuery.isEmpty {
                Button("Add Task") {
                    showAddTask = true
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private var emptyStateTitle: String {
        if !searchQuery.isEmpty {
            return "No Results"
        }
        switch quickFilter {
        case .all: return "No Tasks"
        case .myTasks: return "No Tasks Assigned"
        case .dueToday: return "Nothing Due Today"
        case .overdue: return "All Caught Up"
        case .urgent: return "No Urgent Tasks"
        }
    }

    private var emptyStateIcon: String {
        if !searchQuery.isEmpty {
            return "magnifyingglass"
        }
        switch quickFilter {
        case .all: return "checkmark.circle"
        case .myTasks: return "person"
        case .dueToday: return "calendar"
        case .overdue: return "party.popper"
        case .urgent: return "flame"
        }
    }

    private var emptyStateMessage: String {
        if !searchQuery.isEmpty {
            return "No tasks match '\(searchQuery)'"
        }
        switch quickFilter {
        case .all: return "Add a task to get started"
        case .myTasks: return "No tasks are assigned to you"
        case .dueToday: return "Enjoy your free day!"
        case .overdue: return "No overdue tasks. Great job!"
        case .urgent: return "No urgent tasks right now"
        }
    }

    // MARK: - Filtered & Sorted Todos

    private var filteredTodos: [Todo] {
        var result = todos

        // Role-based filtering
        if !currentUser.isAdmin {
            result = result.filter { todo in
                todo.createdBy == currentUser.name || todo.assignedTo == currentUser.name
            }
        }

        // Quick filter
        switch quickFilter {
        case .all:
            break
        case .myTasks:
            result = result.filter { $0.createdBy == currentUser.name || $0.assignedTo == currentUser.name }
        case .dueToday:
            result = result.filter { $0.isDueToday }
        case .overdue:
            result = result.filter { $0.isOverdue }
        case .urgent:
            result = result.filter { $0.priority == .urgent }
        }

        // Show/hide completed
        if !showCompleted {
            result = result.filter { !$0.completed && $0.status != .done }
        }

        // Search
        if !searchQuery.isEmpty {
            let query = searchQuery.lowercased()
            result = result.filter { todo in
                todo.text.lowercased().contains(query) ||
                todo.createdBy.lowercased().contains(query) ||
                (todo.assignedTo?.lowercased().contains(query) ?? false) ||
                (todo.notes?.lowercased().contains(query) ?? false)
            }
        }

        // Sort
        switch sortOption {
        case .created:
            result.sort { $0.createdAt > $1.createdAt }
        case .dueDate:
            result.sort { (todo1, todo2) in
                switch (todo1.dueDate, todo2.dueDate) {
                case (nil, nil): return false
                case (nil, _): return false
                case (_, nil): return true
                case (let d1?, let d2?): return d1 < d2
                }
            }
        case .priority:
            result.sort { $0.priority < $1.priority }
        case .alphabetical:
            result.sort { $0.text.localizedCaseInsensitiveCompare($1.text) == .orderedAscending }
        }

        return result
    }

    private func countForFilter(_ filter: QuickFilter) -> Int {
        var base = todos

        if !currentUser.isAdmin {
            base = base.filter { $0.createdBy == currentUser.name || $0.assignedTo == currentUser.name }
        }

        if !showCompleted {
            base = base.filter { !$0.completed && $0.status != .done }
        }

        switch filter {
        case .all:
            return base.count
        case .myTasks:
            return base.filter { $0.createdBy == currentUser.name || $0.assignedTo == currentUser.name }.count
        case .dueToday:
            return base.filter { $0.isDueToday }.count
        case .overdue:
            return base.filter { $0.isOverdue }.count
        case .urgent:
            return base.filter { $0.priority == .urgent }.count
        }
    }

    // MARK: - Data Loading

    private func loadTasks() async {
        isLoading = true

        do {
            todos = try await SupabaseService.shared.fetchTodos()
            syncService.cacheTodos(todos)
        } catch {
            self.error = error
            // Fall back to cache if offline
            if !syncService.isOnline {
                todos = syncService.getCachedTodos()
            }
        }

        isLoading = false
    }

    private func startRealtimeSubscription() async {
        realtimeChannel = await SupabaseService.shared.subscribeTodos(
            onInsert: { todo in
                if !todos.contains(where: { $0.id == todo.id }) {
                    todos.insert(todo, at: 0)
                }
            },
            onUpdate: { todo in
                if let index = todos.firstIndex(where: { $0.id == todo.id }) {
                    todos[index] = todo
                }
            },
            onDelete: { id in
                todos.removeAll { $0.id == id }
            }
        )
    }

    // MARK: - Actions

    private func addTask(_ task: Todo) {
        // Optimistic update
        todos.insert(task, at: 0)

        Task {
            do {
                let created = try await SupabaseService.shared.createTodo(task)
                // Update with server response
                if let index = todos.firstIndex(where: { $0.id == task.id }) {
                    todos[index] = created
                }
            } catch {
                // Remove on failure
                todos.removeAll { $0.id == task.id }
                // Queue for sync if offline
                syncService.queueCreate(task)
            }
        }
    }

    private func updateTask(_ task: Todo) {
        // Optimistic update
        if let index = todos.firstIndex(where: { $0.id == task.id }) {
            todos[index] = task
        }

        Task {
            do {
                _ = try await SupabaseService.shared.updateTodo(task)
            } catch {
                // Queue for sync if offline
                syncService.queueUpdate(task)
            }
        }
    }

    private func deleteTask(_ task: Todo) {
        // Optimistic update
        todos.removeAll { $0.id == task.id }

        Task {
            do {
                try await SupabaseService.shared.deleteTodo(id: task.id)
            } catch {
                // Queue for sync if offline
                syncService.queueDelete(todoId: task.id)
            }
        }
    }

    private func toggleComplete(_ task: Todo) {
        let updated = task.toggled()
        updateTask(updated)
    }

    private func toggleSelection(_ id: String) {
        if selectedTodos.contains(id) {
            selectedTodos.remove(id)
        } else {
            selectedTodos.insert(id)
        }
    }

    private func bulkComplete() {
        for id in selectedTodos {
            if let task = todos.first(where: { $0.id == id }) {
                let updated = task.withStatus(.done)
                updateTask(updated)
            }
        }
        selectedTodos.removeAll()
        isSelecting = false
    }

    private func bulkAssign() {
        // Would show a picker - simplified for now
    }

    private func bulkDelete() {
        for id in selectedTodos {
            if let task = todos.first(where: { $0.id == id }) {
                deleteTask(task)
            }
        }
        selectedTodos.removeAll()
        isSelecting = false
    }
}

// MARK: - Filter Chip

struct FilterChip: View {
    let title: String
    let icon: String
    let count: Int
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)

                Text(title)
                    .font(.subheadline.weight(.medium))

                if count > 0 {
                    Text("\(count)")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.white.opacity(0.3) : Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.accentColor : Color(.systemGray6))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    TaskListView(currentUser: .sample, users: User.samples)
        .environment(SyncService.shared)
}
