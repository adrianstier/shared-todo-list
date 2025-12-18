import SwiftUI

/// Confetti celebration effect for task completion
struct CelebrationEffect: View {
    let isActive: Bool

    @State private var particles: [Particle] = []

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                ForEach(particles) { particle in
                    Circle()
                        .fill(particle.color)
                        .frame(width: particle.size, height: particle.size)
                        .position(particle.position)
                        .opacity(particle.opacity)
                }
            }
        }
        .allowsHitTesting(false)
        .onChange(of: isActive) { _, newValue in
            if newValue {
                startCelebration()
            }
        }
    }

    private func startCelebration() {
        // Generate particles
        particles = (0..<50).map { _ in
            Particle(
                id: UUID(),
                position: CGPoint(
                    x: CGFloat.random(in: 100...300),
                    y: -20
                ),
                velocity: CGPoint(
                    x: CGFloat.random(in: -100...100),
                    y: CGFloat.random(in: 200...400)
                ),
                color: [Color.red, .orange, .yellow, .green, .blue, .purple, .pink].randomElement()!,
                size: CGFloat.random(in: 6...12),
                opacity: 1.0
            )
        }

        // Animate particles
        withAnimation(.easeOut(duration: 2.0)) {
            for i in particles.indices {
                particles[i].position.y += particles[i].velocity.y
                particles[i].position.x += particles[i].velocity.x
                particles[i].opacity = 0
            }
        }

        // Clean up
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            particles.removeAll()
        }
    }

    struct Particle: Identifiable {
        let id: UUID
        var position: CGPoint
        var velocity: CGPoint
        let color: Color
        let size: CGFloat
        var opacity: Double
    }
}

/// View modifier for celebration effect
struct CelebrationModifier: ViewModifier {
    let isActive: Bool

    func body(content: Content) -> some View {
        content
            .overlay {
                CelebrationEffect(isActive: isActive)
            }
    }
}

extension View {
    func celebration(isActive: Bool) -> some View {
        modifier(CelebrationModifier(isActive: isActive))
    }
}

/// Haptic feedback manager
struct HapticManager {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }

    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }

    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }

    static func taskCompleted() {
        notification(.success)
    }

    static func taskDeleted() {
        notification(.warning)
    }

    static func error() {
        notification(.error)
    }
}

// MARK: - Shake Effect

struct ShakeEffect: GeometryEffect {
    var amount: CGFloat = 10
    var shakesPerUnit: CGFloat = 3
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        let translation = amount * sin(animatableData * .pi * shakesPerUnit)
        return ProjectionTransform(CGAffineTransform(translationX: translation, y: 0))
    }
}

extension View {
    func shake(trigger: Bool) -> some View {
        modifier(ShakeModifier(trigger: trigger))
    }
}

struct ShakeModifier: ViewModifier {
    let trigger: Bool
    @State private var shakeAmount: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .modifier(ShakeEffect(animatableData: shakeAmount))
            .onChange(of: trigger) { _, _ in
                withAnimation(.linear(duration: 0.5)) {
                    shakeAmount = 1
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    shakeAmount = 0
                }
            }
    }
}

// MARK: - Preview

#Preview("Celebration Effect") {
    struct PreviewWrapper: View {
        @State private var celebrate = false

        var body: some View {
            VStack(spacing: 40) {
                Text("Complete a task!")
                    .font(.title)

                Button("Celebrate!") {
                    celebrate = true
                    HapticManager.taskCompleted()

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        celebrate = false
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .celebration(isActive: celebrate)
        }
    }

    return PreviewWrapper()
}
