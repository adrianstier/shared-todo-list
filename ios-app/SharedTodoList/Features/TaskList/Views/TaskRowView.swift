import SwiftUI

struct TaskRowView: View {
    let todo: Todo
    let onToggle: () -> Void
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                // Checkbox
                checkboxButton

                // Content
                VStack(alignment: .leading, spacing: 6) {
                    // Task text
                    Text(todo.text)
                        .font(.body)
                        .strikethrough(todo.completed)
                        .foregroundStyle(todo.completed ? .secondary : .primary)
                        .lineLimit(2)

                    // Metadata row
                    metadataRow
                }

                Spacer(minLength: 0)

                // Status indicator
                StatusBadge(status: todo.status)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Checkbox

    private var checkboxButton: some View {
        Button(action: onToggle) {
            ZStack {
                Circle()
                    .stroke(checkboxColor, lineWidth: 2)
                    .frame(width: 24, height: 24)

                if todo.completed {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 24, height: 24)

                    Image(systemName: "checkmark")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var checkboxColor: Color {
        if todo.completed {
            return .green
        }
        switch todo.priority {
        case .urgent: return .red
        case .high: return .orange
        case .medium: return .blue
        case .low: return .gray
        }
    }

    // MARK: - Metadata Row

    private var metadataRow: some View {
        HStack(spacing: 8) {
            // Priority badge
            PriorityBadge(priority: todo.priority, style: .compact)

            // Due date
            if let dueDate = todo.dueDate {
                DueDateBadge(
                    date: dueDate,
                    isOverdue: todo.isOverdue,
                    isDueToday: todo.isDueToday
                )
            }

            // Subtask count
            if todo.hasSubtasks {
                subtaskIndicator
            }

            Spacer(minLength: 0)

            // Assignee
            if let assignee = todo.assignedTo {
                assigneeLabel(assignee)
            }
        }
    }

    // MARK: - Subtask Indicator

    private var subtaskIndicator: some View {
        HStack(spacing: 4) {
            Image(systemName: "list.bullet")
                .font(.caption2)

            Text("\(todo.completedSubtaskCount)/\(todo.totalSubtaskCount)")
                .font(.caption)

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color(.systemGray5))
                        .frame(height: 3)

                    Capsule()
                        .fill(Color.green)
                        .frame(width: geometry.size.width * todo.subtaskProgress, height: 3)
                }
            }
            .frame(width: 30, height: 3)
        }
        .foregroundStyle(.secondary)
    }

    // MARK: - Assignee Label

    private func assigneeLabel(_ name: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "person.fill")
                .font(.caption2)

            Text(name)
                .font(.caption)
                .lineLimit(1)
        }
        .foregroundStyle(.secondary)
    }
}

// MARK: - Priority Badge

struct PriorityBadge: View {
    let priority: TodoPriority
    var style: Style = .default

    enum Style {
        case `default`
        case compact
        case full
    }

    var body: some View {
        HStack(spacing: 4) {
            if style != .compact {
                Image(systemName: priority.icon)
                    .font(.caption2)
            }

            if style == .full {
                Text(priority.displayName)
                    .font(.caption)
            }
        }
        .foregroundStyle(priority.color)
        .padding(.horizontal, style == .compact ? 6 : 8)
        .padding(.vertical, 3)
        .background(priority.color.opacity(0.15))
        .clipShape(Capsule())
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: TodoStatus
    var style: Style = .icon

    enum Style {
        case icon
        case text
        case full
    }

    var body: some View {
        Group {
            switch style {
            case .icon:
                Image(systemName: status.icon)
                    .font(.caption)
                    .foregroundStyle(status.color)

            case .text:
                Text(status.displayName)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(status.color)

            case .full:
                HStack(spacing: 4) {
                    Image(systemName: status.icon)
                        .font(.caption2)
                    Text(status.displayName)
                        .font(.caption)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(status.color)
                .clipShape(Capsule())
            }
        }
    }
}

// MARK: - Due Date Badge

struct DueDateBadge: View {
    let date: Date
    let isOverdue: Bool
    let isDueToday: Bool

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: iconName)
                .font(.caption2)

            Text(formattedDate)
                .font(.caption)
        }
        .foregroundStyle(foregroundColor)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(backgroundColor)
        .clipShape(Capsule())
    }

    private var iconName: String {
        if isOverdue {
            return "exclamationmark.circle"
        } else if isDueToday {
            return "clock"
        } else {
            return "calendar"
        }
    }

    private var foregroundColor: Color {
        if isOverdue {
            return .red
        } else if isDueToday {
            return .orange
        } else {
            return .secondary
        }
    }

    private var backgroundColor: Color {
        if isOverdue {
            return .red.opacity(0.15)
        } else if isDueToday {
            return .orange.opacity(0.15)
        } else {
            return Color(.systemGray6)
        }
    }

    private var formattedDate: String {
        if isDueToday {
            return "Today"
        } else if Calendar.current.isDateInTomorrow(date) {
            return "Tomorrow"
        } else if isOverdue {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .abbreviated
            return formatter.localizedString(for: date, relativeTo: Date())
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }
}

// MARK: - Preview

#Preview("Task Row") {
    List {
        TaskRowView(
            todo: .sample,
            onToggle: {},
            onTap: {}
        )

        TaskRowView(
            todo: Todo(
                text: "Urgent task with long title that might wrap to multiple lines",
                priority: .urgent,
                createdBy: "Derrick",
                dueDate: Date().addingTimeInterval(-86400)
            ),
            onToggle: {},
            onTap: {}
        )

        TaskRowView(
            todo: Todo(
                text: "Completed task",
                completed: true,
                status: .done,
                createdBy: "Sefra"
            ),
            onToggle: {},
            onTap: {}
        )
    }
    .listStyle(.plain)
}

#Preview("Badges") {
    VStack(spacing: 20) {
        HStack(spacing: 8) {
            ForEach(TodoPriority.allCases) { priority in
                PriorityBadge(priority: priority, style: .full)
            }
        }

        HStack(spacing: 8) {
            ForEach(TodoStatus.allCases) { status in
                StatusBadge(status: status, style: .full)
            }
        }

        HStack(spacing: 8) {
            DueDateBadge(date: Date(), isOverdue: false, isDueToday: true)
            DueDateBadge(date: Date().addingTimeInterval(-86400), isOverdue: true, isDueToday: false)
            DueDateBadge(date: Date().addingTimeInterval(86400 * 3), isOverdue: false, isDueToday: false)
        }
    }
    .padding()
}
