import SwiftUI

struct LoginView: View {
    let users: [User]
    let onUsersRefresh: () async -> Void

    @Environment(AuthService.self) private var authService
    @State private var selectedUser: User?
    @State private var pin = ""
    @State private var isAuthenticating = false
    @State private var error: String?
    @State private var showCreateAccount = false
    @State private var lockoutTimer: Timer?
    @State private var lockoutSeconds = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Header
                    headerSection

                    // User Selection
                    if !users.isEmpty {
                        userSelectionSection
                    } else {
                        emptyUsersSection
                    }

                    // PIN Pad (when user selected)
                    if selectedUser != nil {
                        pinSection
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    Spacer(minLength: 50)

                    // Biometric Login
                    if authService.canUseBiometrics {
                        biometricButton
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create Account") {
                        showCreateAccount = true
                    }
                }
            }
            .sheet(isPresented: $showCreateAccount) {
                CreateAccountView(onCreated: { user in
                    Task { await onUsersRefresh() }
                })
            }
            .onAppear {
                startLockoutTimerIfNeeded()
            }
            .onDisappear {
                lockoutTimer?.invalidate()
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(Color(hex: Config.Colors.primaryBlue) ?? .blue)

            Text("Shared Todo List")
                .font(.largeTitle.bold())

            Text("Select your account to continue")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 40)
    }

    // MARK: - User Selection Section

    private var userSelectionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Select User")
                .font(.headline)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(users) { user in
                    UserCard(
                        user: user,
                        isSelected: selectedUser?.id == user.id,
                        onTap: {
                            withAnimation(.spring(response: 0.3)) {
                                if selectedUser?.id == user.id {
                                    selectedUser = nil
                                } else {
                                    selectedUser = user
                                    pin = ""
                                    error = nil
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    // MARK: - Empty Users Section

    private var emptyUsersSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.2.slash")
                .font(.system(size: 50))
                .foregroundStyle(.secondary)

            Text("No users found")
                .font(.headline)

            Text("Create an account to get started")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button("Create Account") {
                showCreateAccount = true
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 40)
    }

    // MARK: - PIN Section

    private var pinSection: some View {
        VStack(spacing: 20) {
            // PIN dots
            HStack(spacing: 16) {
                ForEach(0..<Config.pinLength, id: \.self) { index in
                    Circle()
                        .fill(index < pin.count ? Color.primary : Color(.systemGray4))
                        .frame(width: 16, height: 16)
                }
            }
            .animation(.easeInOut(duration: 0.1), value: pin.count)

            // Error message
            if let error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .transition(.opacity)
            }

            // Lockout message
            if authService.isLocked {
                Text("Too many attempts. Try again in \(lockoutSeconds)s")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }

            // PIN Pad
            PINPadView(
                pin: $pin,
                isDisabled: isAuthenticating || authService.isLocked,
                onComplete: authenticate
            )

            // Loading indicator
            if isAuthenticating {
                ProgressView()
                    .padding(.top, 8)
            }
        }
    }

    // MARK: - Biometric Button

    private var biometricButton: some View {
        Button {
            Task { await authenticateWithBiometrics() }
        } label: {
            Label("Use \(authService.biometricTypeName)", systemImage: authService.biometricIcon)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.bottom, 32)
    }

    // MARK: - Actions

    private func authenticate() {
        guard let user = selectedUser else { return }
        guard pin.count == Config.pinLength else { return }
        guard !authService.isLocked else { return }

        isAuthenticating = true
        error = nil

        Task {
            do {
                _ = try await authService.login(user: user, pin: pin)
            } catch let authError as AuthError {
                await MainActor.run {
                    error = authError.errorDescription
                    pin = ""
                    startLockoutTimerIfNeeded()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    pin = ""
                }
            }

            await MainActor.run {
                isAuthenticating = false
            }
        }
    }

    private func authenticateWithBiometrics() async {
        do {
            _ = try await authService.authenticateWithBiometrics()
        } catch {
            await MainActor.run {
                self.error = error.localizedDescription
            }
        }
    }

    private func startLockoutTimerIfNeeded() {
        guard authService.isLocked else {
            lockoutTimer?.invalidate()
            lockoutSeconds = 0
            return
        }

        lockoutSeconds = authService.lockoutRemainingSeconds

        lockoutTimer?.invalidate()
        lockoutTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if authService.isLocked {
                lockoutSeconds = authService.lockoutRemainingSeconds
            } else {
                lockoutTimer?.invalidate()
                lockoutSeconds = 0
            }
        }
    }
}

// MARK: - User Card

struct UserCard: View {
    let user: User
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 12) {
                // Avatar
                Circle()
                    .fill(user.uiColor)
                    .frame(width: 60, height: 60)
                    .overlay {
                        Text(user.initials)
                            .font(.title2.bold())
                            .foregroundStyle(.white)
                    }
                    .overlay {
                        if isSelected {
                            Circle()
                                .stroke(Color.primary, lineWidth: 3)
                        }
                    }

                // Name
                Text(user.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)

                // Role badge
                if user.isAdmin {
                    Text("Admin")
                        .font(.caption2)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.blue)
                        .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.primary, lineWidth: 2)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - PIN Pad View

struct PINPadView: View {
    @Binding var pin: String
    let isDisabled: Bool
    let onComplete: () -> Void

    private let buttons: [[String]] = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["", "0", "delete"]
    ]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(buttons, id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { button in
                        PINButton(
                            label: button,
                            isDisabled: isDisabled,
                            onTap: { handleTap(button) }
                        )
                    }
                }
            }
        }
    }

    private func handleTap(_ button: String) {
        guard !isDisabled else { return }

        switch button {
        case "delete":
            if !pin.isEmpty {
                pin.removeLast()
            }
        case "":
            break
        default:
            if pin.count < Config.pinLength {
                pin += button

                if pin.count == Config.pinLength {
                    onComplete()
                }
            }
        }
    }
}

struct PINButton: View {
    let label: String
    let isDisabled: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Group {
                if label == "delete" {
                    Image(systemName: "delete.left")
                        .font(.title2)
                } else if label.isEmpty {
                    Color.clear
                } else {
                    Text(label)
                        .font(.title)
                        .fontWeight(.medium)
                }
            }
            .frame(width: 80, height: 80)
            .background(label.isEmpty ? Color.clear : Color(.secondarySystemGroupedBackground))
            .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled || label.isEmpty)
        .opacity(isDisabled ? 0.5 : 1)
    }
}

// MARK: - Preview

#Preview {
    LoginView(users: User.samples) { }
        .environment(AuthService.shared)
}
