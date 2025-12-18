import Foundation

/// Errors from AI service
enum AIError: LocalizedError {
    case enhancementFailed(String)
    case parseFailed(String)
    case transcriptionFailed(String)
    case networkError(Error)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .enhancementFailed(let msg):
            return "Enhancement failed: \(msg)"
        case .parseFailed(let msg):
            return "Parse failed: \(msg)"
        case .transcriptionFailed(let msg):
            return "Transcription failed: \(msg)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
}

/// Service for AI-powered features
@Observable
final class AIService {
    static let shared = AIService()

    private let baseURL: String
    private let session: URLSession

    private init() {
        baseURL = Config.apiBaseURL

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)
    }

    // MARK: - Enhance Task

    struct EnhanceResponse: Codable {
        let success: Bool
        let enhanced: EnhancedTask?
        let error: String?
    }

    struct EnhancedTask: Codable {
        let text: String
        let priority: String?
        let dueDate: String?
        let assignedTo: String?
        let wasEnhanced: Bool
    }

    /// Enhance a task using AI
    /// - Parameters:
    ///   - text: The original task text
    ///   - users: List of available users for assignment
    /// - Returns: Enhanced task with improved text and extracted metadata
    func enhanceTask(text: String, users: [String]) async throws -> EnhancedTask {
        guard Config.aiEnabled else {
            return EnhancedTask(
                text: text,
                priority: nil,
                dueDate: nil,
                assignedTo: nil,
                wasEnhanced: false
            )
        }

        let url = URL(string: "\(baseURL)/api/ai/enhance-task")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["text": text, "users": users]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AIError.invalidResponse
        }

        let result = try JSONDecoder().decode(EnhanceResponse.self, from: data)

        guard result.success, let enhanced = result.enhanced else {
            throw AIError.enhancementFailed(result.error ?? "Unknown error")
        }

        return enhanced
    }

    // MARK: - Smart Parse

    struct SmartParseResponse: Codable {
        let success: Bool
        let result: ParsedResult?
        let error: String?
    }

    struct ParsedResult: Codable {
        let mainTask: String
        let subtasks: [ParsedSubtask]
        let summary: String
        let wasComplex: Bool
    }

    struct ParsedSubtask: Codable {
        let text: String
        let priority: String
        let estimatedMinutes: Int?
    }

    /// Parse complex input into a main task and subtasks
    /// - Parameters:
    ///   - text: The complex input text (can be multi-line, bullets, etc.)
    ///   - users: List of available users
    /// - Returns: Parsed result with main task and subtasks
    func smartParse(text: String, users: [String]) async throws -> ParsedResult {
        guard Config.aiEnabled else {
            return ParsedResult(
                mainTask: text,
                subtasks: [],
                summary: text,
                wasComplex: false
            )
        }

        let url = URL(string: "\(baseURL)/api/ai/smart-parse")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["text": text, "users": users]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AIError.invalidResponse
        }

        let result = try JSONDecoder().decode(SmartParseResponse.self, from: data)

        guard result.success, let parsed = result.result else {
            throw AIError.parseFailed(result.error ?? "Unknown error")
        }

        return parsed
    }

    // MARK: - Parse Content to Subtasks

    struct SubtaskParseResponse: Codable {
        let success: Bool
        let subtasks: [ParsedSubtask]?
        let summary: String?
        let error: String?
    }

    /// Parse content (email, notes, etc.) into subtasks
    /// - Parameters:
    ///   - content: The content to parse
    ///   - contentType: Type of content (email, notes, etc.)
    ///   - parentTaskText: The parent task text for context
    /// - Returns: Array of parsed subtasks
    func parseContentToSubtasks(
        content: String,
        contentType: String,
        parentTaskText: String
    ) async throws -> [ParsedSubtask] {
        guard Config.aiEnabled else {
            return []
        }

        let url = URL(string: "\(baseURL)/api/ai/parse-content-to-subtasks")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "content": content,
            "contentType": contentType,
            "parentTaskText": parentTaskText
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AIError.invalidResponse
        }

        let result = try JSONDecoder().decode(SubtaskParseResponse.self, from: data)

        guard result.success, let subtasks = result.subtasks else {
            throw AIError.parseFailed(result.error ?? "Unknown error")
        }

        return subtasks
    }

    // MARK: - Helpers

    /// Convert parsed subtask to Subtask model
    func convertToSubtask(_ parsed: ParsedSubtask) -> Subtask {
        Subtask(
            text: parsed.text,
            completed: false,
            priority: TodoPriority(rawValue: parsed.priority) ?? .medium,
            estimatedMinutes: parsed.estimatedMinutes
        )
    }

    /// Convert array of parsed subtasks to Subtask models
    func convertToSubtasks(_ parsed: [ParsedSubtask]) -> [Subtask] {
        parsed.map { convertToSubtask($0) }
    }

    /// Parse due date string from AI response
    func parseDueDate(_ dateString: String?) -> Date? {
        guard let dateString else { return nil }

        // Try various formats
        let formatters: [DateFormatter] = [
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd"
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
                return f
            }(),
            {
                let f = DateFormatter()
                f.dateStyle = .short
                return f
            }()
        ]

        for formatter in formatters {
            if let date = formatter.date(from: dateString) {
                return date
            }
        }

        // Try natural language
        let calendar = Calendar.current
        let today = Date()

        switch dateString.lowercased() {
        case "today":
            return calendar.startOfDay(for: today)
        case "tomorrow":
            return calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: today))
        case "next week":
            return calendar.date(byAdding: .weekOfYear, value: 1, to: calendar.startOfDay(for: today))
        case "next month":
            return calendar.date(byAdding: .month, value: 1, to: calendar.startOfDay(for: today))
        default:
            return nil
        }
    }
}
