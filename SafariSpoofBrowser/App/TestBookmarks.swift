import Foundation

struct TestBookmark: Identifiable, Hashable {
    let id: String
    let title: String
    let path: String
    let scheme: String
    let port: Int

    func url(host: String) -> String {
        let trimmed = host.trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(scheme)://\(trimmed):\(port)\(path)"
    }

    static let all: [TestBookmark] = [
        TestBookmark(id: "home", title: "Тесты", path: "/", scheme: "http", port: 8080),
        TestBookmark(id: "fingerprint", title: "Fingerprint", path: "/fingerprint-diff/", scheme: "http", port: 8080),
        TestBookmark(id: "webrtc", title: "WebRTC", path: "/webrtc-inspector/", scheme: "https", port: 8443),
        TestBookmark(id: "media", title: "Media Timing", path: "/media-timing/", scheme: "https", port: 8443),
        TestBookmark(id: "permission", title: "Permissions", path: "/permission-behavior/", scheme: "https", port: 8443)
    ]
}

enum TestServerSettings {
    private static let hostKey = "testServerHost"

    static var host: String {
        get {
            UserDefaults.standard.string(forKey: hostKey) ?? "192.168.2.113"
        }
        set {
            UserDefaults.standard.set(newValue, forKey: hostKey)
        }
    }
}

enum NetworkStreamSettings {
    private static let urlKey = "networkStreamURL"

    static var url: String? {
        get { UserDefaults.standard.string(forKey: urlKey) }
        set {
            if let newValue, !newValue.isEmpty {
                UserDefaults.standard.set(newValue, forKey: urlKey)
            } else {
                UserDefaults.standard.removeObject(forKey: urlKey)
            }
        }
    }
}