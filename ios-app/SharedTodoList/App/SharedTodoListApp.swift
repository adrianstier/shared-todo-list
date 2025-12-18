import SwiftUI
import SwiftData

@main
struct SharedTodoListApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            CachedTodo.self,
            CachedUser.self,
            PendingOperation.self
        ])

        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            groupContainer: .identifier(Config.appGroupIdentifier)
        )

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(AuthService.shared)
                .environment(SyncService.shared)
                .environment(NotificationService.shared)
                .onAppear {
                    // Configure sync service with model context
                    SyncService.shared.configure(
                        modelContext: sharedModelContainer.mainContext
                    )
                }
        }
        .modelContainer(sharedModelContainer)
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Request notification authorization
        Task {
            await NotificationService.shared.requestAuthorization()
        }

        return true
    }

    // MARK: - Push Notifications

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        NotificationService.shared.handleDeviceToken(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        NotificationService.shared.handleDeviceTokenError(error)
    }

    // MARK: - Background Fetch

    func application(
        _ application: UIApplication,
        performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task {
            // Sync pending operations
            await SyncService.shared.syncPendingOperations()
            completionHandler(.newData)
        }
    }
}
