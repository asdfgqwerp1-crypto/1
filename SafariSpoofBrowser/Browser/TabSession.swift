import Foundation

struct TabSession: Identifiable, Codable, Equatable {
    let id: UUID
    var url: String
    var title: String
    var profileID: String
    var isEphemeral: Bool
    let createdAt: Date

    init(
        id: UUID = UUID(),
        url: String = "",
        title: String = "Новая вкладка",
        profileID: String,
        isEphemeral: Bool = false,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.url = url
        self.title = title
        self.profileID = profileID
        self.isEphemeral = isEphemeral
        self.createdAt = createdAt
    }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty, trimmed != "Новая вкладка" { return trimmed }
        if let host = URL(string: URLNormalizer.normalize(url))?.host, !host.isEmpty {
            return host
        }
        return "Новая вкладка"
    }
}

struct BrowserSnapshot: Codable, Equatable {
    var tabs: [TabSession]
    var activeTabID: UUID
    var activeProfileID: String
    var savedAt: Date

    static let empty = BrowserSnapshot(
        tabs: [],
        activeTabID: UUID(),
        activeProfileID: ProfileStore.preferredDefaultId,
        savedAt: .distantPast
    )
}