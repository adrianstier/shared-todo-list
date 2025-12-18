import SwiftUI

struct TaskDetailView: View {
    let task: Todo
    let currentUser: User
    let users: [String]
    let onUpdate: (Todo) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var text: String
    @State private var priority: TodoPriority
    @State private var status: TodoStatus
    @State private var assignedTo: String?
    @State private var dueDate: Date?
    @State private var showDueDatePicker: Bool
    @State private var notes: String
    @State private var recurrence: RecurrencePattern?
    @State private var subtasks: [Subtask]

    @State private var showDeleteConfirmation = false
    @State private var newSubtaskText = ""

    init(
        task: Todo,
        currentUser: User,
        users: [String],
        onUpdate: @escaping (Todo) -> Void,
        onDelete: @escaping () -> Void
    ) {
        self.task = task
        self.currentUser = currentUser
        self.users = users
        self.onUpdate = onUpdate
        self.onDelete = onDelete

        _text = State(initialValue: task.text)
        _priority = State(initialValue: task.priority)
        _status = State(initialValue: task.status)
        _assignedTo = State(initialValue: task.assignedTo)
        _dueDate = State(initialValue: task.dueDate)
        _showDueDatePicker = State(initialValue: task.dueDate != nil)
        _notes = State(initialValue: task.notes ?? "")
        _recurrence = State(initialValue: task.recurrence)
        _subtasks = State(initialValue: task.subtasks ?? [])
    }

    var body: some View {
        NavigationStack {
            Form {
                // Task text
                Section {
                    TextField("Task", text: $text, axis: .vertical)
                        .lineLimit(3...6)
                }

                // Status & Priority
                Section {
                    // Status picker
                    Picker("Status", selection: $status) {
                        ForEach(TodoStatus.allCases) { s in
                            Label(s.displayName, systemImage: s.icon)
                                .tag(s)
                        }
                    }
                    .pickerStyle(.segmented)

                    // Priority
                    Picker("Priority", selection: $priority) {
                        ForEach(TodoPriority.allCases) { p in
                            Label(p.displayName, systemImage: p.icon)
                                .tag(p)
                        }
                    }
                }

                // Assignment & Due Date
                Section {
                    // Assignee
                    Picker("Assigned To", selection: $assignedTo) {
                        Text("Unassigned").tag(nil as String?)
                        ForEach(users, id: \.self) { user in
                            Text(user).tag(user as String?)
                        }
                    }

                    // Due date toggle
                    Toggle("Due Date", isOn: $showDueDatePicker)

                    if showDueDatePicker {
                        DatePicker(
                            "Due",
                            selection: Binding(
                                get: { dueDate ?? Date() },
                                set: { dueDate = $0 }
                            ),
                            displayedComponents: [.date, .hourAndMinute]
                        )
                    }

                    // Recurrence
                    Picker("Repeat", selection: $recurrence) {
                        Text("Never").tag(nil as RecurrencePattern?)
                        ForEach(RecurrencePattern.allCases) { r in
                            Label(r.displayName, systemImage: r.icon)
                                .tag(r as RecurrencePattern?)
                        }
                    }
                }

                // Subtasks
                Section {
                    // Existing subtasks
                    ForEach($subtasks) { $subtask in
                        SubtaskRow(subtask: $subtask)
                    }
                    .onDelete { indices in
                        subtasks.remove(atOffsets: indices)
                    }
                    .onMove { from, to in
                        subtasks.move(fromOffsets: from, toOffset: to)
                    }

                    // Add new subtask
                    HStack {
                        Image(systemName: "plus.circle")
                            .foregroundStyle(.secondary)

                        TextField("Add subtask", text: $newSubtaskText)
                            .onSubmit {
                                addSubtask()
                            }
                    }
                } header: {
                    HStack {
                        Text("Subtasks")
                        Spacer()
                        if !subtasks.isEmpty {
                            Text("\(subtasks.filter { $0.completed }.count)/\(subtasks.count)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Notes
                Section("Notes") {
                    TextField("Add notes...", text: $notes, axis: .vertical)
                        .lineLimit(5...10)
                }

                // Metadata
                Section("Info") {
                    LabeledContent("Created by", value: task.createdBy)
                    LabeledContent("Created", value: task.createdAt.formatted(date: .abbreviated, time: .shortened))

                    if let updatedAt = task.updatedAt {
                        LabeledContent("Updated", value: updatedAt.formatted(date: .abbreviated, time: .shortened))
                    }

                    if let updatedBy = task.updatedBy {
                        LabeledContent("Updated by", value: updatedBy)
                    }
                }

                // Delete button
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Delete Task", systemImage: "trash")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Task Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveChanges()
                    }
                    .fontWeight(.semibold)
                    .disabled(!hasChanges)
                }

                ToolbarItem(placement: .bottomBar) {
                    EditButton()
                }
            }
            .confirmationDialog(
                "Delete Task",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    onDelete()
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to delete this task? This action cannot be undone.")
            }
        }
    }

    // MARK: - Computed Properties

    private var hasChanges: Bool {
        text != task.text ||
        priority != task.priority ||
        status != task.status ||
        assignedTo != task.assignedTo ||
        dueDate != task.dueDate ||
        (showDueDatePicker && dueDate != task.dueDate) ||
        (!showDueDatePicker && task.dueDate != nil) ||
        notes != (task.notes ?? "") ||
        recurrence != task.recurrence ||
        subtasks != (task.subtasks ?? [])
    }

    // MARK: - Actions

    private func addSubtask() {
        let trimmed = newSubtaskText.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }

        let subtask = Subtask(text: trimmed)
        subtasks.append(subtask)
        newSubtaskText = ""
    }

    private func saveChanges() {
        var updated = task
        updated.text = text.trimmingCharacters(in: .whitespaces)
        updated.priority = priority
        updated.status = status
        updated.completed = status == .done
        updated.assignedTo = assignedTo
        updated.dueDate = showDueDatePicker ? dueDate : nil
        updated.notes = notes.isEmpty ? nil : notes
        updated.recurrence = recurrence
        updated.subtasks = subtasks.isEmpty ? nil : subtasks
        updated.updatedAt = Date()
        updated.updatedBy = currentUser.name

        onUpdate(updated)
        dismiss()
    }
}

// MARK: - Subtask Row

struct SubtaskRow: View {
    @Binding var subtask: Subtask

    var body: some View {
        HStack(spacing: 12) {
            // Checkbox
            Button {
                subtask.completed.toggle()
            } label: {
                Image(systemName: subtask.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(subtask.completed ? .green : .secondary)
            }
            .buttonStyle(.plain)

            // Text
            TextField("Subtask", text: $subtask.text)
                .strikethrough(subtask.completed)
                .foregroundStyle(subtask.completed ? .secondary : .primary)

            // Priority indicator
            PriorityBadge(priority: subtask.priority, style: .compact)

            // Estimated time
            if let minutes = subtask.estimatedMinutes {
                Text("\(minutes)m")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    TaskDetailView(
        task: .sample,
        currentUser: .sample,
        users: ["Derrick", "Sefra"],
        onUpdate: { _ in },
        onDelete: {}
    )
}
