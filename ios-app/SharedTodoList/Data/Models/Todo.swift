import Foundation
import SwiftData
import SwiftUI

// MARK: - Enums

enum TodoStatus: String, Codable, CaseIterable, Identifiable {
    case todo = "todo"
    case inProgress = "in_progress"
    case done = "done"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .todo: return "To Do"
        case .inProgress: return "In Progress"
        case .done: return "Done"
        }
    }

    var icon: String {
        switch self {
        case .todo: return "circle"
        case .inProgress: return "clock"
        case .done: return "checkmark.circle.fill"
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

enum TodoPriority: String, Codable, CaseIterable, Identifiable, Comparable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case urgent = "urgent"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .urgent: return "Urgent"
        }
    }

    var icon: String {
        switch self {
        case .low: return "arrow.down"
        case .medium: return "minus"
        case .high: return "arrow.up"
        case .urgent: return "exclamationmark.2"
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

enum RecurrencePattern: String, Codable, CaseIterable, Identifiable {
    case daily = "daily"
    case weekly = "weekly"
    case monthly = "monthly"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        }
    }

    var icon: String {
        switch self {
        case .daily: return "sun.max"
        case .weekly: return "calendar.badge.clock"
        case .monthly: return "calendar"
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

    init(
        id: String = UUID().uuidString,
        text: String,
        completed: Bool = false,
        priority: TodoPriority = .medium,
        estimatedMinutes: Int? = nil
    ) {
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

    // MARK: - Computed Properties

    var isOverdue: Bool {
        guard let dueDate = dueDate, !completed, status != .done else { return false }
        return dueDate < Date()
    }

    var isDueToday: Bool {
        guard let dueDate = dueDate else { return false }
        return Calendar.current.isDateInToday(dueDate)
    }

    var isDueTomorrow: Bool {
        guard let dueDate = dueDate else { return false }
        return Calendar.current.isDateInTomorrow(dueDate)
    }

    var isDueThisWeek: Bool {
        guard let dueDate = dueDate else { return false }
        return Calendar.current.isDate(dueDate, equalTo: Date(), toGranularity: .weekOfYear)
    }

    var completedSubtaskCount: Int {
        subtasks?.filter { $0.completed }.count ?? 0
    }

    var totalSubtaskCount: Int {
        subtasks?.count ?? 0
    }

    var subtaskProgress: Double {
        guard totalSubtaskCount > 0 else { return 0 }
        return Double(completedSubtaskCount) / Double(totalSubtaskCount)
    }

    var hasSubtasks: Bool {
        totalSubtaskCount > 0
    }

    var formattedDueDate: String? {
        guard let dueDate = dueDate else { return nil }

        if isDueToday {
            return "Today"
        } else if isDueTomorrow {
            return "Tomorrow"
        } else if isOverdue {
            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .short
            return formatter.localizedString(for: dueDate, relativeTo: Date())
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: dueDate)
        }
    }

    // MARK: - Initializers

    init(
        id: String = UUID().uuidString,
        text: String,
        completed: Bool = false,
        status: TodoStatus = .todo,
        priority: TodoPriority = .medium,
        createdAt: Date = Date(),
        createdBy: String,
        assignedTo: String? = nil,
        dueDate: Date? = nil,
        notes: String? = nil,
        recurrence: RecurrencePattern? = nil,
        updatedAt: Date? = nil,
        updatedBy: String? = nil,
        subtasks: [Subtask]? = nil
    ) {
        self.id = id
        self.text = text
        self.completed = completed
        self.status = status
        self.priority = priority
        self.createdAt = createdAt
        self.createdBy = createdBy
        self.assignedTo = assignedTo
        self.dueDate = dueDate
        self.notes = notes
        self.recurrence = recurrence
        self.updatedAt = updatedAt
        self.updatedBy = updatedBy
        self.subtasks = subtasks
    }

    // MARK: - Mutations

    func toggled() -> Todo {
        var copy = self
        copy.completed = !completed
        copy.status = copy.completed ? .done : .todo
        copy.updatedAt = Date()
        return copy
    }

    func withStatus(_ newStatus: TodoStatus) -> Todo {
        var copy = self
        copy.status = newStatus
        copy.completed = newStatus == .done
        copy.updatedAt = Date()
        return copy
    }

    func withPriority(_ newPriority: TodoPriority) -> Todo {
        var copy = self
        copy.priority = newPriority
        copy.updatedAt = Date()
        return copy
    }

    func withAssignee(_ assignee: String?, updatedBy: String) -> Todo {
        var copy = self
        copy.assignedTo = assignee
        copy.updatedAt = Date()
        copy.updatedBy = updatedBy
        return copy
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
    var pendingOperation: String? // "create", "update", "delete"

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
        self.needsSync = false
        self.lastSyncedAt = Date()
        self.locallyDeleted = false
    }

    func update(from todo: Todo) {
        self.text = todo.text
        self.completed = todo.completed
        self.status = todo.status.rawValue
        self.priority = todo.priority.rawValue
        self.assignedTo = todo.assignedTo
        self.dueDate = todo.dueDate
        self.notes = todo.notes
        self.recurrence = todo.recurrence?.rawValue
        self.updatedAt = todo.updatedAt
        self.updatedBy = todo.updatedBy
        self.subtasksData = try? JSONEncoder().encode(todo.subtasks)
        self.lastSyncedAt = Date()
    }

    func toTodo() -> Todo {
        let subtasks: [Subtask]? = subtasksData.flatMap {
            try? JSONDecoder().decode([Subtask].self, from: $0)
        }

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

    func markForSync(operation: String) {
        self.needsSync = true
        self.pendingOperation = operation
    }
}

// MARK: - Sample Data

extension Todo {
    static let sample = Todo(
        id: "sample-1",
        text: "Buy groceries for the week",
        completed: false,
        status: .todo,
        priority: .medium,
        createdAt: Date(),
        createdBy: "Derrick",
        assignedTo: "Sefra",
        dueDate: Calendar.current.date(byAdding: .day, value: 1, to: Date()),
        notes: "Don't forget the milk!",
        subtasks: [
            Subtask(text: "Milk", completed: true),
            Subtask(text: "Bread", completed: false),
            Subtask(text: "Eggs", completed: false)
        ]
    )

    static let samples: [Todo] = [
        Todo(
            id: "sample-1",
            text: "Buy groceries for the week",
            completed: false,
            status: .todo,
            priority: .high,
            createdAt: Date(),
            createdBy: "Derrick",
            assignedTo: "Sefra",
            dueDate: Calendar.current.date(byAdding: .day, value: 1, to: Date())
        ),
        Todo(
            id: "sample-2",
            text: "Schedule dentist appointment",
            completed: false,
            status: .inProgress,
            priority: .medium,
            createdAt: Date().addingTimeInterval(-86400),
            createdBy: "Sefra"
        ),
        Todo(
            id: "sample-3",
            text: "Pay electricity bill",
            completed: true,
            status: .done,
            priority: .urgent,
            createdAt: Date().addingTimeInterval(-172800),
            createdBy: "Derrick",
            dueDate: Date().addingTimeInterval(-86400)
        )
    ]
}
