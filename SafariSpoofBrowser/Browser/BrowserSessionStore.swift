import Foundation

enum BrowserSessionStore {
    private static let snapshotKey = "com.safarispoof.browserSnapshot"

    static func load() -> BrowserSnapshot? {
        guard let data = UserDefaults.standard.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(BrowserSnapshot.self, from: data)
    }

    static func save(_ snapshot: BrowserSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: snapshotKey)
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: snapshotKey)
    }
}

enum BrowserSessionSettings {
    private static let profileKey = "com.safarispoof.activeProfileId"

    static var activeProfileID: String? {
        get { UserDefaults.standard.string(forKey: profileKey) }
        set {
            if let newValue {
                UserDefaults.standard.set(newValue, forKey: profileKey)
            } else {
                UserDefaults.standard.removeObject(forKey: profileKey)
            }
        }
    }
}