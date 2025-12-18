import SwiftUI

/// Root view that handles authentication routing
struct ContentView: View {
    @Environment(AuthService.self) private var authService
    @Environment(SyncService.self) private var syncService

    @State private var users: [User] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showError = false

    var body: some View {
        Group {
            if isLoading {
                LoadingView(message: "Loading...")
            } else if authService.isAuthenticated, let user = authService.currentUser {
                MainTabView(currentUser: user, users: users)
            } else {
                LoginView(users: users, onUsersRefresh: loadUsers)
            }
        }
        .task {
            await loadUsers()
        }
        .alert("Error", isPresented: $showError) {
            Button("Retry") {
                Task { await loadUsers() }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(error?.localizedDescription ?? "An unknown error occurred")
        }
    }

    private func loadUsers() async {
        isLoading = true
        error = nil

        do {
            users = try await SupabaseService.shared.fetchUsers()

            // Try to restore session
            if !authService.isAuthenticated {
                _ = authService.restoreSession(from: users)
            }
        } catch {
            self.error = error

            // If offline, try to load from cache
            if !syncService.isOnline {
                users = User.samples // Fallback to sample data
            } else {
                showError = true
            }
        }

        isLoading = false
    }
}

// MARK: - Main Tab View

struct MainTabView: View {
    let currentUser: User
    let users: [User]

    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            TaskListView(currentUser: currentUser, users: users)
                .tabItem {
                    Label("Tasks", systemImage: "checkmark.circle")
                }
                .tag(0)

            KanbanContainerView(currentUser: currentUser, users: users)
                .tabItem {
                    Label("Board", systemImage: "rectangle.split.3x1")
                }
                .tag(1)

            SettingsView(users: users)
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
    }
}

// MARK: - Kanban Container

struct KanbanContainerView: View {
    let currentUser: User
    let users: [User]

    var body: some View {
        NavigationStack {
            KanbanView(currentUser: currentUser, users: users)
                .navigationTitle("Board")
        }
    }
}

// MARK: - Loading View

struct LoadingView: View {
    let message: String

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .environment(AuthService.shared)
        .environment(SyncService.shared)
        .environment(NotificationService.shared)
}
