import Foundation

@MainActor
final class DebugLogStore: ObservableObject {
    static let shared = DebugLogStore()

    struct Entry: Identifiable, Equatable {
        let id = UUID()
        let date: Date
        let level: String
        let message: String
    }

    @Published private(set) var entries: [Entry] = []

    private let maxEntries = 250

    private init() {}

    func append(level: String, message: String) {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        entries.append(Entry(date: Date(), level: level, message: trimmed))
        if entries.count > maxEntries {
            entries.removeFirst(entries.count - maxEntries)
        }
    }

    func clear() {
        entries.removeAll()
    }

    func exportText() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return entries.map { entry in
            "[\(formatter.string(from: entry.date))] \(entry.level.uppercased()) \(entry.message)"
        }.joined(separator: "\n")
    }
}