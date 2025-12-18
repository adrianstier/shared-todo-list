import Foundation
import UserNotifications
import UIKit

/// Service for managing push and local notifications
@Observable
final class NotificationService: NSObject {
    static let shared = NotificationService()

    // MARK: - Properties

    private(set) var isAuthorized = false
    private(set) var deviceToken: String?
    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    // MARK: - Notification Categories

    enum Category: String {
        case taskReminder = "TASK_REMINDER"
        case taskAssigned = "TASK_ASSIGNED"
        case taskOverdue = "TASK_OVERDUE"
    }

    enum Action: String {
        case complete = "COMPLETE_ACTION"
        case snooze = "SNOOZE_ACTION"
        case view = "VIEW_ACTION"
    }

    // MARK: - Initialization

    override private init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Authorization

    /// Request notification permissions
    func requestAuthorization() async -> Bool {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(options: [
                .alert,
                .sound,
                .badge,
                .provisional // Silent notifications for non-urgent
            ])

            await MainActor.run {
                isAuthorized = granted
            }

            if granted {
                await registerForRemoteNotifications()
                await setupNotificationCategories()
            }

            await checkAuthorizationStatus()

            return granted
        } catch {
            print("Notification authorization failed: \(error)")
            return false
        }
    }

    /// Check current authorization status
    func checkAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        await MainActor.run {
            authorizationStatus = settings.authorizationStatus
            isAuthorized = settings.authorizationStatus == .authorized ||
                          settings.authorizationStatus == .provisional
        }
    }

    /// Register for remote (push) notifications
    @MainActor
    private func registerForRemoteNotifications() async {
        UIApplication.shared.registerForRemoteNotifications()
    }

    // MARK: - Device Token

    /// Handle device token from AppDelegate
    func handleDeviceToken(_ token: Data) {
        deviceToken = token.map { String(format: "%02.2hhx", $0) }.joined()

        if Config.logNetworkRequests {
            print("[Notifications] Device token: \(deviceToken ?? "nil")")
        }

        // Register with server
        Task {
            await registerTokenWithServer()
        }
    }

    /// Handle device token registration failure
    func handleDeviceTokenError(_ error: Error) {
        print("[Notifications] Failed to register for remote notifications: \(error)")
    }

    /// Register token with Supabase
    private func registerTokenWithServer() async {
        guard let token = deviceToken,
              let userId = AuthService.shared.currentUser?.id else { return }

        do {
            try await SupabaseService.shared.registerDeviceToken(
                userId: userId,
                token: token
            )

            if Config.logNetworkRequests {
                print("[Notifications] Token registered with server")
            }
        } catch {
            print("[Notifications] Failed to register token: \(error)")
        }
    }

    /// Remove token from server on logout
    func removeTokenFromServer() async {
        guard let token = deviceToken else { return }

        do {
            try await SupabaseService.shared.removeDeviceToken(token: token)
        } catch {
            print("[Notifications] Failed to remove token: \(error)")
        }
    }

    // MARK: - Notification Categories

    private func setupNotificationCategories() async {
        let completeAction = UNNotificationAction(
            identifier: Action.complete.rawValue,
            title: "Complete",
            options: [.foreground]
        )

        let snoozeAction = UNNotificationAction(
            identifier: Action.snooze.rawValue,
            title: "Snooze 1 Hour",
            options: []
        )

        let viewAction = UNNotificationAction(
            identifier: Action.view.rawValue,
            title: "View",
            options: [.foreground]
        )

        let reminderCategory = UNNotificationCategory(
            identifier: Category.taskReminder.rawValue,
            actions: [completeAction, snoozeAction],
            intentIdentifiers: [],
            options: []
        )

        let assignedCategory = UNNotificationCategory(
            identifier: Category.taskAssigned.rawValue,
            actions: [viewAction],
            intentIdentifiers: [],
            options: []
        )

        let overdueCategory = UNNotificationCategory(
            identifier: Category.taskOverdue.rawValue,
            actions: [completeAction, viewAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([
            reminderCategory,
            assignedCategory,
            overdueCategory
        ])
    }

    // MARK: - Local Notifications

    /// Schedule a due date reminder for a task
    func scheduleDueReminder(for todo: Todo, reminderOffset: TimeInterval = Config.defaultReminderOffset) {
        guard let dueDate = todo.dueDate else { return }

        let triggerDate = dueDate.addingTimeInterval(-reminderOffset)

        // Don't schedule if trigger time is in the past
        guard triggerDate > Date() else { return }

        let content = UNMutableNotificationContent()
        content.title = "Task Due Soon"
        content.body = todo.text
        content.sound = .default
        content.badge = 1
        content.categoryIdentifier = Category.taskReminder.rawValue
        content.userInfo = [
            "taskId": todo.id,
            "type": "due_reminder"
        ]

        // Add thread identifier for grouping
        content.threadIdentifier = "task-reminders"

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: triggerDate.timeIntervalSinceNow,
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: "due-\(todo.id)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                print("[Notifications] Failed to schedule reminder: \(error)")
            }
        }
    }

    /// Cancel due reminder for a task
    func cancelDueReminder(for todoId: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["due-\(todoId)"]
        )
    }

    /// Schedule overdue notification
    func scheduleOverdueNotification(for todo: Todo) {
        guard let dueDate = todo.dueDate, dueDate < Date() else { return }

        let content = UNMutableNotificationContent()
        content.title = "Overdue Task"
        content.body = todo.text
        content.sound = .default
        content.categoryIdentifier = Category.taskOverdue.rawValue
        content.interruptionLevel = .timeSensitive
        content.userInfo = [
            "taskId": todo.id,
            "type": "overdue"
        ]

        let request = UNNotificationRequest(
            identifier: "overdue-\(todo.id)",
            content: content,
            trigger: nil // Deliver immediately
        )

        UNUserNotificationCenter.current().add(request)
    }

    /// Show local notification for task assignment
    func showTaskAssignedNotification(task: Todo, assignedBy: String) {
        let content = UNMutableNotificationContent()
        content.title = "New Task Assigned"
        content.body = "\(assignedBy) assigned you: \(task.text)"
        content.sound = .default
        content.categoryIdentifier = Category.taskAssigned.rawValue
        content.userInfo = [
            "taskId": task.id,
            "type": "assigned"
        ]

        let request = UNNotificationRequest(
            identifier: "assigned-\(task.id)-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Badge Management

    /// Update app badge count
    @MainActor
    func updateBadgeCount(_ count: Int) {
        UIApplication.shared.applicationIconBadgeNumber = count
    }

    /// Clear badge
    @MainActor
    func clearBadge() {
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    // MARK: - Notification Management

    /// Get all pending notifications
    func getPendingNotifications() async -> [UNNotificationRequest] {
        await UNUserNotificationCenter.current().pendingNotificationRequests()
    }

    /// Remove all pending notifications
    func removeAllPendingNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    /// Remove all delivered notifications
    func removeAllDeliveredNotifications() {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {
    /// Handle notification when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        // Show notification even when app is in foreground
        return [.banner, .sound, .badge]
    }

    /// Handle notification action
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        let taskId = userInfo["taskId"] as? String

        switch response.actionIdentifier {
        case Action.complete.rawValue:
            // Complete the task
            if let taskId {
                await handleCompleteAction(taskId: taskId)
            }

        case Action.snooze.rawValue:
            // Snooze for 1 hour
            if let taskId {
                await handleSnoozeAction(taskId: taskId)
            }

        case Action.view.rawValue,
             UNNotificationDefaultActionIdentifier:
            // Open the task
            if let taskId {
                await handleViewAction(taskId: taskId)
            }

        default:
            break
        }
    }

    private func handleCompleteAction(taskId: String) async {
        // This would need to be connected to the task repository
        print("[Notifications] Complete action for task: \(taskId)")
        // TODO: Implement task completion
    }

    private func handleSnoozeAction(taskId: String) async {
        // Reschedule notification for 1 hour from now
        // Would need to fetch the task first
        print("[Notifications] Snooze action for task: \(taskId)")
        // TODO: Implement snooze
    }

    private func handleViewAction(taskId: String) async {
        // Navigate to the task
        // This would post a notification that the UI can observe
        NotificationCenter.default.post(
            name: .openTask,
            object: nil,
            userInfo: ["taskId": taskId]
        )
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let openTask = Notification.Name("openTask")
}
