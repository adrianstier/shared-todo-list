import SwiftUI

struct AddTaskView: View {
    let currentUser: User
    let users: [String]
    let onAdd: (Todo) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var priority: TodoPriority = .medium
    @State private var status: TodoStatus = .todo
    @State private var assignedTo: String?
    @State private var dueDate: Date?
    @State private var showDueDatePicker = false
    @State private var notes = ""
    @State private var recurrence: RecurrencePattern?

    @State private var isEnhancing = false
    @State private var showSmartParse = false
    @State private var parsedResult: AIService.ParsedResult?

    @FocusState private var isTextFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                // Main task input
                Section {
                    TextField("What needs to be done?", text: $text, axis: .vertical)
                        .lineLimit(3...6)
                        .focused($isTextFocused)

                    // AI Actions
                    HStack(spacing: 12) {
                        // Enhance button
                        Button {
                            Task { await enhanceTask() }
                        } label: {
                            Label("Enhance", systemImage: "sparkles")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .disabled(text.isEmpty || isEnhancing)

                        // Smart parse button
                        Button {
                            Task { await smartParse() }
                        } label: {
                            Label("Smart Parse", systemImage: "wand.and.stars")
                                .font(.subheadline)
                        }
                        .buttonStyle(.bordered)
                        .disabled(text.isEmpty || isEnhancing)

                        if isEnhancing {
                            ProgressView()
                                .scaleEffect(0.8)
                        }

                        Spacer()

                        // Voice input button
                        Button {
                            // Would trigger voice input
                        } label: {
                            Image(systemName: "mic.fill")
                        }
                        .buttonStyle(.bordered)
                    }
                }

                // Quick options
                Section("Options") {
                    // Priority
                    Picker("Priority", selection: $priority) {
                        ForEach(TodoPriority.allCases) { p in
                            Label(p.displayName, systemImage: p.icon)
                                .tag(p)
                        }
                    }

                    // Status
                    Picker("Status", selection: $status) {
                        ForEach(TodoStatus.allCases) { s in
                            Label(s.displayName, systemImage: s.icon)
                                .tag(s)
                        }
                    }

                    // Assignee
                    Picker("Assign To", selection: $assignedTo) {
                        Text("Unassigned").tag(nil as String?)
                        ForEach(users, id: \.self) { user in
                            Text(user).tag(user as String?)
                        }
                    }

                    // Due date
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

                // Notes
                Section("Notes") {
                    TextField("Add notes...", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        addTask()
                    }
                    .fontWeight(.semibold)
                    .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                isTextFocused = true
            }
            .sheet(isPresented: $showSmartParse) {
                if let result = parsedResult {
                    SmartParseSheet(
                        result: result,
                        onConfirm: { mainText, subtasks in
                            addTaskWithSubtasks(mainText: mainText, subtasks: subtasks)
                        }
                    )
                }
            }
        }
    }

    // MARK: - Actions

    private func addTask() {
        let newTask = Todo(
            text: text.trimmingCharacters(in: .whitespaces),
            completed: false,
            status: status,
            priority: priority,
            createdBy: currentUser.name,
            assignedTo: assignedTo,
            dueDate: showDueDatePicker ? dueDate : nil,
            notes: notes.isEmpty ? nil : notes,
            recurrence: recurrence
        )

        onAdd(newTask)
        dismiss()
    }

    private func addTaskWithSubtasks(mainText: String, subtasks: [Subtask]) {
        let newTask = Todo(
            text: mainText,
            completed: false,
            status: status,
            priority: priority,
            createdBy: currentUser.name,
            assignedTo: assignedTo,
            dueDate: showDueDatePicker ? dueDate : nil,
            notes: notes.isEmpty ? nil : notes,
            recurrence: recurrence,
            subtasks: subtasks.isEmpty ? nil : subtasks
        )

        onAdd(newTask)
        dismiss()
    }

    private func enhanceTask() async {
        isEnhancing = true
        defer { isEnhancing = false }

        do {
            let enhanced = try await AIService.shared.enhanceTask(
                text: text,
                users: users
            )

            await MainActor.run {
                if enhanced.wasEnhanced {
                    text = enhanced.text

                    if let priorityStr = enhanced.priority,
                       let p = TodoPriority(rawValue: priorityStr) {
                        priority = p
                    }

                    if let assignee = enhanced.assignedTo {
                        assignedTo = assignee
                    }

                    if let dueDateStr = enhanced.dueDate,
                       let date = AIService.shared.parseDueDate(dueDateStr) {
                        dueDate = date
                        showDueDatePicker = true
                    }
                }
            }
        } catch {
            print("Enhancement failed: \(error)")
        }
    }

    private func smartParse() async {
        isEnhancing = true
        defer { isEnhancing = false }

        do {
            let result = try await AIService.shared.smartParse(
                text: text,
                users: users
            )

            await MainActor.run {
                if result.wasComplex {
                    parsedResult = result
                    showSmartParse = true
                } else {
                    // Simple task - just update text
                    text = result.mainTask
                }
            }
        } catch {
            print("Smart parse failed: \(error)")
        }
    }
}

// MARK: - Smart Parse Sheet

struct SmartParseSheet: View {
    let result: AIService.ParsedResult
    let onConfirm: (String, [Subtask]) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var mainTask: String
    @State private var subtasks: [Subtask]

    init(result: AIService.ParsedResult, onConfirm: @escaping (String, [Subtask]) -> Void) {
        self.result = result
        self.onConfirm = onConfirm
        _mainTask = State(initialValue: result.mainTask)
        _subtasks = State(initialValue: AIService.shared.convertToSubtasks(result.subtasks))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(result.summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } header: {
                    Label("AI Analysis", systemImage: "sparkles")
                }

                Section("Main Task") {
                    TextField("Task", text: $mainTask, axis: .vertical)
                }

                Section("Subtasks (\(subtasks.count))") {
                    ForEach($subtasks) { $subtask in
                        HStack {
                            Image(systemName: subtask.completed ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(subtask.completed ? .green : .secondary)

                            TextField("Subtask", text: $subtask.text)

                            if let minutes = subtask.estimatedMinutes {
                                Text("\(minutes)m")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { indices in
                        subtasks.remove(atOffsets: indices)
                    }
                    .onMove { from, to in
                        subtasks.move(fromOffsets: from, toOffset: to)
                    }
                }
            }
            .navigationTitle("Review Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        onConfirm(mainTask, subtasks)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }

                ToolbarItem(placement: .bottomBar) {
                    EditButton()
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Preview

#Preview {
    AddTaskView(
        currentUser: .sample,
        users: ["Derrick", "Sefra"]
    ) { _ in }
}
