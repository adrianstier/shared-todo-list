import SwiftUI

/// Displays a user avatar with initials
struct AvatarView: View {
    let name: String
    let color: Color
    var size: CGFloat = 40

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay {
                Text(initials)
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(.white)
            }
    }

    private var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}

/// Avatar with optional selection ring
struct SelectableAvatarView: View {
    let name: String
    let color: Color
    var size: CGFloat = 40
    var isSelected: Bool = false

    var body: some View {
        AvatarView(name: name, color: color, size: size)
            .overlay {
                if isSelected {
                    Circle()
                        .stroke(Color.primary, lineWidth: 3)
                }
            }
    }
}

/// Avatar stack for showing multiple assignees
struct AvatarStackView: View {
    let names: [String]
    let colors: [Color]
    var size: CGFloat = 28
    var maxVisible: Int = 3
    var overlap: CGFloat = 0.3

    var body: some View {
        HStack(spacing: -(size * overlap)) {
            ForEach(Array(visibleNames.enumerated()), id: \.offset) { index, name in
                AvatarView(
                    name: name,
                    color: colors.indices.contains(index) ? colors[index] : .gray,
                    size: size
                )
                .overlay {
                    Circle()
                        .stroke(Color(.systemBackground), lineWidth: 2)
                }
            }

            if remainingCount > 0 {
                Circle()
                    .fill(Color(.systemGray4))
                    .frame(width: size, height: size)
                    .overlay {
                        Text("+\(remainingCount)")
                            .font(.system(size: size * 0.35, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                    .overlay {
                        Circle()
                            .stroke(Color(.systemBackground), lineWidth: 2)
                    }
            }
        }
    }

    private var visibleNames: [String] {
        Array(names.prefix(maxVisible))
    }

    private var remainingCount: Int {
        max(0, names.count - maxVisible)
    }
}

// MARK: - Preview

#Preview("Avatars") {
    VStack(spacing: 24) {
        // Single avatars
        HStack(spacing: 16) {
            AvatarView(name: "Derrick", color: .blue)
            AvatarView(name: "Sefra Johnson", color: .orange)
            AvatarView(name: "A", color: .green, size: 50)
        }

        // Selectable
        HStack(spacing: 16) {
            SelectableAvatarView(name: "Derrick", color: .blue, isSelected: false)
            SelectableAvatarView(name: "Sefra", color: .orange, isSelected: true)
        }

        // Stack
        HStack(spacing: 32) {
            AvatarStackView(
                names: ["Derrick", "Sefra"],
                colors: [.blue, .orange]
            )

            AvatarStackView(
                names: ["Derrick", "Sefra", "Alex", "Jordan", "Taylor"],
                colors: [.blue, .orange, .green, .purple, .pink]
            )
        }
    }
    .padding()
}
