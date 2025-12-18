import SwiftUI

struct SettingsView: View {
    let users: [User]

    @Environment(AuthService.self) private var authService
    @Environment(SyncService.self) private var syncService
    @Environment(NotificationService.self) private var notificationService

    @State private var showLogoutConfirmation = false
    @State private var showSwitchUser = false

    var body: some View {
        NavigationStack {
            List {
                // Profile section
                if let user = authService.currentUser {
                    profileSection(user)
                }

                // Notifications
                notificationsSection

                // Security
                securitySection

                // Sync status
                syncSection

                // About
                aboutSection

                // Account actions
                accountSection
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showSwitchUser) {
                SwitchUserView(users: users)
            }
            .confirmationDialog(
                "Log Out",
                isPresented: $showLogoutConfirmation,
                titleVisibility: .visible
            ) {
                Button("Log Out", role: .destructive) {
                    logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to log out?")
            }
        }
    }

    // MARK: - Profile Section

    private func profileSection(_ user: User) -> some View {
        Section {
            HStack(spacing: 16) {
                // Avatar
                Circle()
                    .fill(user.uiColor)
                    .frame(width: 60, height: 60)
                    .overlay {
                        Text(user.initials)
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                    }

                VStack(alignment: .leading, spacing: 4) {
                    Text(user.name)
                        .font(.headline)

                    HStack(spacing: 8) {
                        Text(user.role.displayName)
                            .font(.caption)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(user.isAdmin ? Color.blue : Color.gray)
                            .clipShape(Capsule())

                        if user.hasActiveStreak && user.currentStreak > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "flame.fill")
                                    .foregroundStyle(.orange)
                                Text("\(user.currentStreak) day streak")
                            }
                            .font(.caption)
                            .foregroundStyle(.orange)
                        }
                    }
                }

                Spacer()
            }
            .padding(.vertical, 8)
        }
    }

    // MARK: - Notifications Section

    private var notificationsSection: some View {
        Section("Notifications") {
            HStack {
                Label("Push Notifications", systemImage: "bell")

                Spacer()

                if notificationService.isAuthorized {
                    Text("Enabled")
                        .foregroundStyle(.green)
                } else {
                    Button("Enable") {
                        Task {
                            await notificationService.requestAuthorization()
                        }
                    }
                }
            }

            NavigationLink {
                NotificationSettingsView()
            } label: {
                Label("Reminder Settings", systemImage: "clock")
            }
        }
    }

    // MARK: - Security Section

    private var securitySection: some View {
        Section("Security") {
            if authService.biometricsAvailable {
                Toggle(isOn: Binding(
                    get: { authService.canUseBiometrics },
                    set: { enabled in
                        Task {
                            if enabled {
                                try? await authService.enableBiometrics()
                            } else {
                                authService.disableBiometrics()
                            }
                        }
                    }
                )) {
                    Label("Use \(authService.biometricTypeName)", systemImage: authService.biometricIcon)
                }
            }

            NavigationLink {
                ChangePINView()
            } label: {
                Label("Change PIN", systemImage: "lock")
            }
        }
    }

    // MARK: - Sync Section

    private var syncSection: some View {
        Section("Sync") {
            HStack {
                Label("Status", systemImage: syncService.syncStatus.icon)

                Spacer()

                Text(syncService.syncStatus.displayName)
                    .foregroundStyle(syncService.isOnline ? .green : .orange)
            }

            if syncService.pendingOperationCount > 0 {
                HStack {
                    Label("Pending Changes", systemImage: "arrow.triangle.2.circlepath")

                    Spacer()

                    Text("\(syncService.pendingOperationCount)")
                        .foregroundStyle(.secondary)
                }
            }

            if let lastSync = syncService.lastSyncTime {
                HStack {
                    Label("Last Sync", systemImage: "clock.arrow.circlepath")

                    Spacer()

                    Text(lastSync.formatted(date: .omitted, time: .shortened))
                        .foregroundStyle(.secondary)
                }
            }

            Button {
                Task {
                    await syncService.syncPendingOperations()
                }
            } label: {
                Label("Sync Now", systemImage: "arrow.clockwise")
            }
            .disabled(!syncService.isOnline || syncService.isSyncing)
        }
    }

    // MARK: - About Section

    private var aboutSection: some View {
        Section("About") {
            LabeledContent("Version") {
                Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
            }

            LabeledContent("Build") {
                Text(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
            }

            Link(destination: URL(string: "https://shared-todo-list-production.up.railway.app")!) {
                Label("Open Web App", systemImage: "safari")
            }
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        Section {
            Button {
                showSwitchUser = true
            } label: {
                Label("Switch User", systemImage: "person.2")
            }

            Button(role: .destructive) {
                showLogoutConfirmation = true
            } label: {
                Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
            }
        }
    }

    // MARK: - Actions

    private func logout() {
        Task {
            await notificationService.removeTokenFromServer()
        }
        authService.logout()
    }
}

// MARK: - Switch User View

struct SwitchUserView: View {
    let users: [User]

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthService.self) private var authService

    @State private var selectedUser: User?
    @State private var pin = ""
    @State private var error: String?
    @State private var isAuthenticating = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // User grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(users) { user in
                        UserCard(
                            user: user,
                            isSelected: selectedUser?.id == user.id,
                            onTap: {
                                selectedUser = user
                                pin = ""
                                error = nil
                            }
                        )
                    }
                }
                .padding()

                if selectedUser != nil {
                    // PIN input
                    VStack(spacing: 16) {
                        HStack(spacing: 16) {
                            ForEach(0..<Config.pinLength, id: \.self) { index in
                                Circle()
                                    .fill(index < pin.count ? Color.primary : Color(.systemGray4))
                                    .frame(width: 16, height: 16)
                            }
                        }

                        if let error {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }

                        PINPadView(
                            pin: $pin,
                            isDisabled: isAuthenticating,
                            onComplete: switchUser
                        )
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }

                Spacer()
            }
            .navigationTitle("Switch User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func switchUser() {
        guard let user = selectedUser else { return }

        isAuthenticating = true
        error = nil

        Task {
            do {
                _ = try await authService.switchUser(to: user, pin: pin)
                await MainActor.run {
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    pin = ""
                    isAuthenticating = false
                }
            }
        }
    }
}

// MARK: - Notification Settings View

struct NotificationSettingsView: View {
    @AppStorage("reminderOffset") private var reminderOffset: TimeInterval = Config.defaultReminderOffset
    @AppStorage("notifyOnAssignment") private var notifyOnAssignment = true
    @AppStorage("notifyOnOverdue") private var notifyOnOverdue = true

    var body: some View {
        List {
            Section("Due Date Reminders") {
                Picker("Remind Before", selection: $reminderOffset) {
                    ForEach(Config.reminderOptions, id: \.self) { offset in
                        Text(formatOffset(offset)).tag(offset)
                    }
                }
            }

            Section("Task Notifications") {
                Toggle("When Assigned to Me", isOn: $notifyOnAssignment)
                Toggle("When Task is Overdue", isOn: $notifyOnOverdue)
            }
        }
        .navigationTitle("Notifications")
    }

    private func formatOffset(_ seconds: TimeInterval) -> String {
        let minutes = Int(seconds / 60)
        if minutes < 60 {
            return "\(minutes) minutes"
        } else if minutes == 60 {
            return "1 hour"
        } else if minutes < 1440 {
            return "\(minutes / 60) hours"
        } else {
            return "\(minutes / 1440) day\(minutes >= 2880 ? "s" : "")"
        }
    }
}

// MARK: - Change PIN View

struct ChangePINView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthService.self) private var authService

    @State private var currentPIN = ""
    @State private var newPIN = ""
    @State private var confirmPIN = ""
    @State private var step = 0
    @State private var error: String?

    var body: some View {
        VStack(spacing: 32) {
            // Step indicator
            Text(stepTitle)
                .font(.title2.bold())

            Text(stepDescription)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            // PIN dots
            HStack(spacing: 16) {
                ForEach(0..<Config.pinLength, id: \.self) { index in
                    Circle()
                        .fill(index < currentPINForStep.count ? Color.primary : Color(.systemGray4))
                        .frame(width: 16, height: 16)
                }
            }
            .padding()

            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            // PIN Pad
            PINPadView(
                pin: bindingForStep,
                isDisabled: false,
                onComplete: handleComplete
            )

            Spacer()
        }
        .padding()
        .navigationTitle("Change PIN")
    }

    private var stepTitle: String {
        switch step {
        case 0: return "Current PIN"
        case 1: return "New PIN"
        case 2: return "Confirm PIN"
        default: return ""
        }
    }

    private var stepDescription: String {
        switch step {
        case 0: return "Enter your current PIN"
        case 1: return "Enter your new PIN"
        case 2: return "Enter your new PIN again"
        default: return ""
        }
    }

    private var currentPINForStep: String {
        switch step {
        case 0: return currentPIN
        case 1: return newPIN
        case 2: return confirmPIN
        default: return ""
        }
    }

    private var bindingForStep: Binding<String> {
        switch step {
        case 0: return $currentPIN
        case 1: return $newPIN
        case 2: return $confirmPIN
        default: return $currentPIN
        }
    }

    private func handleComplete() {
        error = nil

        switch step {
        case 0:
            // Verify current PIN
            guard let user = authService.currentUser,
                  authService.hashPIN(currentPIN) == user.pinHash else {
                error = "Incorrect PIN"
                currentPIN = ""
                return
            }
            step = 1

        case 1:
            step = 2

        case 2:
            if newPIN != confirmPIN {
                error = "PINs don't match"
                confirmPIN = ""
                return
            }

            // Save new PIN
            // This would need to call the server to update
            dismiss()

        default:
            break
        }
    }
}

// MARK: - Preview

#Preview {
    SettingsView(users: User.samples)
        .environment(AuthService.shared)
        .environment(SyncService.shared)
        .environment(NotificationService.shared)
}
