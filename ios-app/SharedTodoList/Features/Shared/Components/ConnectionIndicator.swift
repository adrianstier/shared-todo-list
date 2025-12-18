import SwiftUI

/// Displays the current connection status
struct ConnectionIndicator: View {
    let isOnline: Bool
    var pendingCount: Int = 0

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isOnline ? Color.green : Color.orange)
                .frame(width: 8, height: 8)

            Text(isOnline ? "Live" : "Offline")
                .font(.caption.weight(.medium))
                .foregroundStyle(isOnline ? .green : .orange)

            if pendingCount > 0 && !isOnline {
                Text("(\(pendingCount))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(isOnline ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
        )
    }
}

/// Floating connection indicator overlay
struct ConnectionOverlay: View {
    let syncStatus: SyncStatus
    var pendingCount: Int = 0

    var body: some View {
        HStack(spacing: 8) {
            if syncStatus == .syncing {
                ProgressView()
                    .scaleEffect(0.7)
            } else {
                Image(systemName: syncStatus.icon)
                    .font(.caption)
            }

            Text(syncStatus.displayName)
                .font(.caption.weight(.medium))

            if pendingCount > 0 {
                Text("(\(pendingCount) pending)")
                    .font(.caption2)
            }
        }
        .foregroundStyle(foregroundColor)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(backgroundColor)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }

    private var foregroundColor: Color {
        switch syncStatus {
        case .idle: return .green
        case .syncing: return .blue
        case .offline: return .orange
        case .error: return .red
        }
    }

    private var backgroundColor: Color {
        switch syncStatus {
        case .idle: return Color.green.opacity(0.15)
        case .syncing: return Color.blue.opacity(0.15)
        case .offline: return Color.orange.opacity(0.15)
        case .error: return Color.red.opacity(0.15)
        }
    }
}

// MARK: - Preview

#Preview("Connection Indicators") {
    VStack(spacing: 20) {
        ConnectionIndicator(isOnline: true)
        ConnectionIndicator(isOnline: false, pendingCount: 5)

        Divider()

        ConnectionOverlay(syncStatus: .idle)
        ConnectionOverlay(syncStatus: .syncing)
        ConnectionOverlay(syncStatus: .offline, pendingCount: 3)
        ConnectionOverlay(syncStatus: .error("Network timeout"))
    }
    .padding()
}
