import SwiftUI

/// Reusable empty state component
struct EmptyStateView: View {
    let title: String
    let message: String
    let icon: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: icon)
        } description: {
            Text(message)
        } actions: {
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

/// Empty state for task lists
struct TaskEmptyStateView: View {
    let filter: QuickFilter
    var searchQuery: String = ""
    var onAddTask: (() -> Void)?

    var body: some View {
        EmptyStateView(
            title: title,
            message: message,
            icon: icon,
            actionTitle: shouldShowAction ? "Add Task" : nil,
            action: onAddTask
        )
    }

    private var title: String {
        if !searchQuery.isEmpty {
            return "No Results"
        }
        switch filter {
        case .all: return "No Tasks"
        case .myTasks: return "No Tasks Assigned"
        case .dueToday: return "Nothing Due Today"
        case .overdue: return "All Caught Up"
        case .urgent: return "No Urgent Tasks"
        }
    }

    private var message: String {
        if !searchQuery.isEmpty {
            return "No tasks match '\(searchQuery)'"
        }
        switch filter {
        case .all: return "Add a task to get started"
        case .myTasks: return "No tasks are assigned to you"
        case .dueToday: return "Enjoy your free day!"
        case .overdue: return "No overdue tasks. Great job!"
        case .urgent: return "No urgent tasks right now"
        }
    }

    private var icon: String {
        if !searchQuery.isEmpty {
            return "magnifyingglass"
        }
        switch filter {
        case .all: return "checkmark.circle"
        case .myTasks: return "person"
        case .dueToday: return "calendar"
        case .overdue: return "party.popper"
        case .urgent: return "flame"
        }
    }

    private var shouldShowAction: Bool {
        filter == .all && searchQuery.isEmpty
    }
}

/// Empty state for offline mode
struct OfflineEmptyStateView: View {
    var onRetry: (() -> Void)?

    var body: some View {
        EmptyStateView(
            title: "You're Offline",
            message: "Connect to the internet to sync your tasks",
            icon: "wifi.slash",
            actionTitle: "Retry",
            action: onRetry
        )
    }
}

/// Empty state for errors
struct ErrorStateView: View {
    let error: Error
    var onRetry: (() -> Void)?

    var body: some View {
        EmptyStateView(
            title: "Something Went Wrong",
            message: error.localizedDescription,
            icon: "exclamationmark.triangle",
            actionTitle: "Try Again",
            action: onRetry
        )
    }
}

// MARK: - Preview

#Preview("Empty States") {
    TabView {
        TaskEmptyStateView(filter: .all) {}
            .tabItem { Text("All") }

        TaskEmptyStateView(filter: .myTasks)
            .tabItem { Text("My Tasks") }

        TaskEmptyStateView(filter: .all, searchQuery: "groceries")
            .tabItem { Text("Search") }

        OfflineEmptyStateView {}
            .tabItem { Text("Offline") }

        ErrorStateView(error: NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "Network request failed"])) {}
            .tabItem { Text("Error") }
    }
}
