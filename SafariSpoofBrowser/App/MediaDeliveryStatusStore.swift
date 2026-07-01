import Foundation
import Combine

@MainActor
final class MediaDeliveryStatusStore: ObservableObject {
    static let shared = MediaDeliveryStatusStore()

    @Published private(set) var statusLine = "запрос: —"
    @Published private(set) var hasNativeMismatch = false

    private var requestedLabel = "—"
    private var selectedLabel = "—"
    private var nativeLabel = "—"
    private var siteHost = ""

    private init() {}

    func updateSiteRequest(params: [String: Any]) {
        siteHost = (params["host"] as? String) ?? ""
        requestedLabel = (params["requested"] as? String) ?? "—"
        if let facing = params["facingMode"] as? String, !facing.isEmpty {
            requestedLabel += " (\(facing))"
        }
        let width = params["width"] as? Int ?? 0
        let height = params["height"] as? Int ?? 0
        if width > 0, height > 0 {
            selectedLabel = "\(width)×\(height)"
        }
        refresh()
    }

    func updateNativeDelivered(width: Int, height: Int) {
        guard width > 0, height > 0 else { return }
        nativeLabel = "\(width)×\(height)"
        refresh()
    }

    func reset() {
        requestedLabel = "—"
        selectedLabel = "—"
        nativeLabel = "—"
        siteHost = ""
        refresh()
    }

    private func refresh() {
        let host = shortHost(siteHost)
        var line = "запрос \(requestedLabel)"
        if selectedLabel != "—" {
            line += " → \(selectedLabel)"
        }
        if nativeLabel != "—" {
            line += " | натив \(nativeLabel)"
        }
        if !host.isEmpty {
            line = "\(host): \(line)"
        }
        hasNativeMismatch = selectedLabel != "—"
            && nativeLabel != "—"
            && selectedLabel != nativeLabel
        statusLine = line
    }

    private func shortHost(_ host: String) -> String {
        guard !host.isEmpty else { return "" }
        if host.count <= 18 { return host }
        let parts = host.split(separator: ".")
        if parts.count >= 2 {
            return String(parts[parts.count - 2])
        }
        return String(host.prefix(16))
    }
}