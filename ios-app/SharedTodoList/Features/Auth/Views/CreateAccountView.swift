import SwiftUI

struct CreateAccountView: View {
    let onCreated: (User) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var pin = ""
    @State private var confirmPin = ""
    @State private var selectedColor = Config.Colors.primaryBlue
    @State private var isCreating = false
    @State private var error: String?
    @State private var currentStep = 0

    private let colorOptions = [
        "#0033A0", // Primary Blue
        "#D4A853", // Gold
        "#ef4444", // Red
        "#f59e0b", // Orange
        "#10b981", // Green
        "#6366f1", // Indigo
        "#8b5cf6", // Purple
        "#ec4899", // Pink
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Progress indicator
                progressIndicator

                // Step content
                Group {
                    switch currentStep {
                    case 0:
                        nameStep
                    case 1:
                        colorStep
                    case 2:
                        pinStep
                    case 3:
                        confirmPinStep
                    default:
                        EmptyView()
                    }
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))

                Spacer()

                // Error message
                if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                // Navigation buttons
                navigationButtons
            }
            .padding()
            .navigationTitle("Create Account")
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

    // MARK: - Progress Indicator

    private var progressIndicator: some View {
        HStack(spacing: 8) {
            ForEach(0..<4) { step in
                Capsule()
                    .fill(step <= currentStep ? Color.accentColor : Color(.systemGray4))
                    .frame(height: 4)
            }
        }
        .padding(.top)
    }

    // MARK: - Step 1: Name

    private var nameStep: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.circle")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)

            Text("What's your name?")
                .font(.title2.bold())

            Text("This will be displayed to other users")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            TextField("Enter your name", text: $name)
                .textContentType(.name)
                .autocorrectionDisabled()
                .padding()
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(.separator), lineWidth: 1)
                }
        }
    }

    // MARK: - Step 2: Color

    private var colorStep: some View {
        VStack(spacing: 20) {
            // Preview avatar
            Circle()
                .fill(Color(hex: selectedColor) ?? .blue)
                .frame(width: 100, height: 100)
                .overlay {
                    Text(nameInitials)
                        .font(.largeTitle.bold())
                        .foregroundStyle(.white)
                }

            Text("Choose your color")
                .font(.title2.bold())

            Text("This will be your avatar color")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // Color grid
            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 60))
            ], spacing: 16) {
                ForEach(colorOptions, id: \.self) { color in
                    Button {
                        withAnimation(.spring(response: 0.3)) {
                            selectedColor = color
                        }
                    } label: {
                        Circle()
                            .fill(Color(hex: color) ?? .gray)
                            .frame(width: 50, height: 50)
                            .overlay {
                                if selectedColor == color {
                                    Circle()
                                        .stroke(Color.primary, lineWidth: 3)
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.white)
                                        .font(.headline)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top)
        }
    }

    // MARK: - Step 3: PIN

    private var pinStep: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.circle")
                .font(.system(size: 60))
                .foregroundStyle(.secondary)

            Text("Create a PIN")
                .font(.title2.bold())

            Text("Enter a 4-digit PIN to secure your account")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            // PIN dots
            HStack(spacing: 16) {
                ForEach(0..<Config.pinLength, id: \.self) { index in
                    Circle()
                        .fill(index < pin.count ? Color.primary : Color(.systemGray4))
                        .frame(width: 16, height: 16)
                }
            }
            .padding()

            // PIN Pad
            PINPadView(
                pin: $pin,
                isDisabled: false,
                onComplete: {
                    withAnimation {
                        currentStep = 3
                    }
                }
            )
        }
    }

    // MARK: - Step 4: Confirm PIN

    private var confirmPinStep: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.circle.fill")
                .font(.system(size: 60))
                .foregroundStyle(.green)

            Text("Confirm your PIN")
                .font(.title2.bold())

            Text("Enter your PIN again to confirm")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // PIN dots
            HStack(spacing: 16) {
                ForEach(0..<Config.pinLength, id: \.self) { index in
                    Circle()
                        .fill(index < confirmPin.count ? Color.primary : Color(.systemGray4))
                        .frame(width: 16, height: 16)
                }
            }
            .padding()

            // PIN Pad
            PINPadView(
                pin: $confirmPin,
                isDisabled: isCreating,
                onComplete: createAccount
            )

            if isCreating {
                ProgressView()
                    .padding()
            }
        }
    }

    // MARK: - Navigation Buttons

    private var navigationButtons: some View {
        HStack(spacing: 16) {
            // Back button
            if currentStep > 0 && currentStep < 3 {
                Button {
                    withAnimation {
                        currentStep -= 1
                        error = nil
                    }
                } label: {
                    Text("Back")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            // Next/Create button
            if currentStep < 2 {
                Button {
                    nextStep()
                } label: {
                    Text(currentStep == 0 ? "Next" : "Continue")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(canProceed ? Color.accentColor : Color(.systemGray4))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canProceed)
            }
        }
    }

    // MARK: - Helpers

    private var nameInitials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    private var canProceed: Bool {
        switch currentStep {
        case 0:
            return !name.trimmingCharacters(in: .whitespaces).isEmpty
        default:
            return true
        }
    }

    private func nextStep() {
        error = nil

        switch currentStep {
        case 0:
            // Validate name
            let trimmedName = name.trimmingCharacters(in: .whitespaces)
            guard !trimmedName.isEmpty else {
                error = "Please enter your name"
                return
            }
            guard trimmedName.count >= 2 else {
                error = "Name must be at least 2 characters"
                return
            }

        default:
            break
        }

        withAnimation {
            currentStep += 1
        }
    }

    private func createAccount() {
        guard pin == confirmPin else {
            error = "PINs don't match. Please try again."
            confirmPin = ""
            return
        }

        isCreating = true
        error = nil

        Task {
            do {
                let hashedPin = AuthService.shared.hashPIN(pin)

                let newUser = User(
                    name: name.trimmingCharacters(in: .whitespaces),
                    pinHash: hashedPin,
                    color: selectedColor,
                    role: .member
                )

                let createdUser = try await SupabaseService.shared.createUser(newUser)

                await MainActor.run {
                    onCreated(createdUser)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = "Failed to create account: \(error.localizedDescription)"
                    isCreating = false
                    confirmPin = ""
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    CreateAccountView { _ in }
}
