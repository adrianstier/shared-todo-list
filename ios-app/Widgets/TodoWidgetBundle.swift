import WidgetKit
import SwiftUI

// MARK: - Widget Bundle

@main
struct TodoWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayCountWidget()
        UpcomingTasksWidget()
        TaskListWidget()
    }
}

// MARK: - Shared Data

struct WidgetTodo: Codable, Identifiable {
    let id: String
    let text: String
    let priority: String
    let status: String
    let dueDate: Date?
    let assignedTo: String?
    let completed: Bool

    var priorityColor: Color {
        switch priority {
        case "urgent": return .red
        case "high": return .orange
        case "medium": return .blue
        default: return .gray
        }
    }

    var isOverdue: Bool {
        guard let dueDate, !completed else { return false }
        return dueDate < Date()
    }

    var isDueToday: Bool {
        guard let dueDate else { return false }
        return Calendar.current.isDateInToday(dueDate)
    }
}

struct WidgetData: Codable {
    let todos: [WidgetTodo]
    let lastUpdated: Date
}

// MARK: - Data Provider

class WidgetDataProvider {
    static let shared = WidgetDataProvider()

    private let appGroupId = "group.com.yourcompany.sharedtodolist"
    private let dataKey = "widgetData"

    func loadData() -> WidgetData? {
        guard let userDefaults = UserDefaults(suiteName: appGroupId),
              let data = userDefaults.data(forKey: dataKey),
              let widgetData = try? JSONDecoder().decode(WidgetData.self, from: data) else {
            return nil
        }
        return widgetData
    }

    func saveData(_ data: WidgetData) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId),
              let encoded = try? JSONEncoder().encode(data) else {
            return
        }
        userDefaults.set(encoded, forKey: dataKey)
    }

    // Sample data for previews
    static var sampleTodos: [WidgetTodo] {
        [
            WidgetTodo(
                id: "1",
                text: "Buy groceries",
                priority: "high",
                status: "todo",
                dueDate: Date(),
                assignedTo: "Sefra",
                completed: false
            ),
            WidgetTodo(
                id: "2",
                text: "Schedule dentist appointment",
                priority: "medium",
                status: "in_progress",
                dueDate: Calendar.current.date(byAdding: .day, value: 1, to: Date()),
                assignedTo: nil,
                completed: false
            ),
            WidgetTodo(
                id: "3",
                text: "Pay electricity bill",
                priority: "urgent",
                status: "todo",
                dueDate: Calendar.current.date(byAdding: .hour, value: -2, to: Date()),
                assignedTo: "Derrick",
                completed: false
            ),
            WidgetTodo(
                id: "4",
                text: "Review project proposal",
                priority: "medium",
                status: "todo",
                dueDate: Calendar.current.date(byAdding: .day, value: 2, to: Date()),
                assignedTo: nil,
                completed: false
            ),
            WidgetTodo(
                id: "5",
                text: "Call mom",
                priority: "low",
                status: "done",
                dueDate: nil,
                assignedTo: nil,
                completed: true
            )
        ]
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
        .description("Shows task counts at a glance")
        .supportedFamilies([.systemSmall])
    }
}

struct TodayCountEntry: TimelineEntry {
    let date: Date
    let todoCount: Int
    let doneCount: Int
    let overdueCount: Int
    let dueTodayCount: Int
}

struct TodayCountProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayCountEntry {
        TodayCountEntry(date: Date(), todoCount: 5, doneCount: 3, overdueCount: 1, dueTodayCount: 2)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayCountEntry) -> Void) {
        let entry = createEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayCountEntry>) -> Void) {
        let entry = createEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func createEntry() -> TodayCountEntry {
        let data = WidgetDataProvider.shared.loadData()
        let todos = data?.todos ?? WidgetDataProvider.sampleTodos

        let active = todos.filter { !$0.completed && $0.status != "done" }
        let todoCount = active.count
        let doneCount = todos.filter { $0.completed || $0.status == "done" }.count
        let overdueCount = active.filter { $0.isOverdue }.count
        let dueTodayCount = active.filter { $0.isDueToday }.count

        return TodayCountEntry(
            date: Date(),
            todoCount: todoCount,
            doneCount: doneCount,
            overdueCount: overdueCount,
            dueTodayCount: dueTodayCount
        )
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
                VStack(alignment: .leading) {
                    Text("\(entry.todoCount)")
                        .font(.title.bold())
                    Text("To Do")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading) {
                    Text("\(entry.doneCount)")
                        .font(.title.bold())
                        .foregroundStyle(.green)
                    Text("Done")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if entry.overdueCount > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.caption)
                    Text("\(entry.overdueCount) overdue")
                        .font(.caption)
                }
                .foregroundStyle(.red)
            } else if entry.dueTodayCount > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.caption)
                    Text("\(entry.dueTodayCount) due today")
                        .font(.caption)
                }
                .foregroundStyle(.orange)
            }
        }
        .padding()
    }
}

// MARK: - Upcoming Tasks Widget (Medium)

struct UpcomingTasksWidget: Widget {
    let kind = "UpcomingTasksWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UpcomingTasksProvider()) { entry in
            UpcomingTasksWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Upcoming Tasks")
        .description("Shows your next tasks")
        .supportedFamilies([.systemMedium])
    }
}

struct UpcomingTasksEntry: TimelineEntry {
    let date: Date
    let tasks: [WidgetTodo]
}

struct UpcomingTasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> UpcomingTasksEntry {
        UpcomingTasksEntry(date: Date(), tasks: Array(WidgetDataProvider.sampleTodos.prefix(3)))
    }

    func getSnapshot(in context: Context, completion: @escaping (UpcomingTasksEntry) -> Void) {
        let entry = createEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<UpcomingTasksEntry>) -> Void) {
        let entry = createEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func createEntry() -> UpcomingTasksEntry {
        let data = WidgetDataProvider.shared.loadData()
        let todos = data?.todos ?? WidgetDataProvider.sampleTodos

        let active = todos
            .filter { !$0.completed && $0.status != "done" }
            .sorted { (t1, t2) in
                // Sort by: overdue first, then due today, then by due date, then by priority
                if t1.isOverdue != t2.isOverdue { return t1.isOverdue }
                if t1.isDueToday != t2.isDueToday { return t1.isDueToday }
                if let d1 = t1.dueDate, let d2 = t2.dueDate { return d1 < d2 }
                if t1.dueDate != nil { return true }
                if t2.dueDate != nil { return false }
                return priorityOrder(t1.priority) < priorityOrder(t2.priority)
            }

        return UpcomingTasksEntry(date: Date(), tasks: Array(active.prefix(3)))
    }

    private func priorityOrder(_ priority: String) -> Int {
        switch priority {
        case "urgent": return 0
        case "high": return 1
        case "medium": return 2
        default: return 3
        }
    }
}

struct UpcomingTasksWidgetView: View {
    let entry: UpcomingTasksEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "list.bullet.circle.fill")
                    .foregroundStyle(.blue)
                Text("Upcoming")
                    .font(.headline)
                Spacer()
                Text("\(entry.tasks.count) tasks")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if entry.tasks.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "checkmark.circle")
                            .font(.title)
                            .foregroundStyle(.green)
                        Text("All done!")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(entry.tasks) { task in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(task.priorityColor)
                            .frame(width: 8, height: 8)

                        Text(task.text)
                            .font(.subheadline)
                            .lineLimit(1)

                        Spacer()

                        if task.isOverdue {
                            Text("Overdue")
                                .font(.caption2)
                                .foregroundStyle(.red)
                        } else if task.isDueToday {
                            Text("Today")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                        } else if let dueDate = task.dueDate {
                            Text(dueDate, style: .date)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding()
    }
}

// MARK: - Task List Widget (Large)

struct TaskListWidget: Widget {
    let kind = "TaskListWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TaskListProvider()) { entry in
            TaskListWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Task List")
        .description("Shows more of your tasks")
        .supportedFamilies([.systemLarge])
    }
}

struct TaskListEntry: TimelineEntry {
    let date: Date
    let tasks: [WidgetTodo]
    let todoCount: Int
    let doneCount: Int
}

struct TaskListProvider: TimelineProvider {
    func placeholder(in context: Context) -> TaskListEntry {
        TaskListEntry(
            date: Date(),
            tasks: WidgetDataProvider.sampleTodos,
            todoCount: 4,
            doneCount: 1
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (TaskListEntry) -> Void) {
        let entry = createEntry()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TaskListEntry>) -> Void) {
        let entry = createEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func createEntry() -> TaskListEntry {
        let data = WidgetDataProvider.shared.loadData()
        let todos = data?.todos ?? WidgetDataProvider.sampleTodos

        let active = todos.filter { !$0.completed && $0.status != "done" }
        let done = todos.filter { $0.completed || $0.status == "done" }

        let sorted = active.sorted { (t1, t2) in
            if t1.isOverdue != t2.isOverdue { return t1.isOverdue }
            if t1.isDueToday != t2.isDueToday { return t1.isDueToday }
            if let d1 = t1.dueDate, let d2 = t2.dueDate { return d1 < d2 }
            if t1.dueDate != nil { return true }
            if t2.dueDate != nil { return false }
            return priorityOrder(t1.priority) < priorityOrder(t2.priority)
        }

        return TaskListEntry(
            date: Date(),
            tasks: Array(sorted.prefix(6)),
            todoCount: active.count,
            doneCount: done.count
        )
    }

    private func priorityOrder(_ priority: String) -> Int {
        switch priority {
        case "urgent": return 0
        case "high": return 1
        case "medium": return 2
        default: return 3
        }
    }
}

struct TaskListWidgetView: View {
    let entry: TaskListEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.blue)
                Text("Tasks")
                    .font(.headline)
                Spacer()

                HStack(spacing: 12) {
                    Label("\(entry.todoCount)", systemImage: "circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Label("\(entry.doneCount)", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }

            Divider()

            // Task list
            if entry.tasks.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "party.popper")
                            .font(.largeTitle)
                            .foregroundStyle(.green)
                        Text("All caught up!")
                            .font(.headline)
                        Text("No pending tasks")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(entry.tasks) { task in
                    TaskRowWidget(task: task)
                }

                if entry.todoCount > entry.tasks.count {
                    HStack {
                        Spacer()
                        Text("+\(entry.todoCount - entry.tasks.count) more")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding()
    }
}

struct TaskRowWidget: View {
    let task: WidgetTodo

    var body: some View {
        HStack(spacing: 10) {
            // Priority indicator
            Circle()
                .fill(task.priorityColor)
                .frame(width: 10, height: 10)

            // Task text
            VStack(alignment: .leading, spacing: 2) {
                Text(task.text)
                    .font(.subheadline)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    if task.isOverdue {
                        Label("Overdue", systemImage: "exclamationmark.circle")
                            .font(.caption2)
                            .foregroundStyle(.red)
                    } else if task.isDueToday {
                        Label("Today", systemImage: "calendar")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                    } else if let dueDate = task.dueDate {
                        Label(dueDate, format: .dateTime.month(.abbreviated).day())
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    if let assignee = task.assignedTo {
                        Label(assignee, systemImage: "person")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Widget Info.plist

/*
 Add to Widgets/Info.plist:

 <?xml version="1.0" encoding="UTF-8"?>
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
     <key>NSExtension</key>
     <dict>
         <key>NSExtensionPointIdentifier</key>
         <string>com.apple.widgetkit-extension</string>
     </dict>
 </dict>
 </plist>
 */

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    TodayCountWidget()
} timeline: {
    TodayCountEntry(date: Date(), todoCount: 5, doneCount: 3, overdueCount: 1, dueTodayCount: 2)
}

#Preview("Medium", as: .systemMedium) {
    UpcomingTasksWidget()
} timeline: {
    UpcomingTasksEntry(date: Date(), tasks: Array(WidgetDataProvider.sampleTodos.prefix(3)))
}

#Preview("Large", as: .systemLarge) {
    TaskListWidget()
} timeline: {
    TaskListEntry(date: Date(), tasks: WidgetDataProvider.sampleTodos, todoCount: 5, doneCount: 1)
}
