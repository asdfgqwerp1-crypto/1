import Foundation

enum StreamURLResolver {
    static let framePort = 8090

    static func isHttpFrameEndpoint(_ raw: String) -> Bool {
        guard let url = URL(string: raw.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
        return isHttpFrameURL(url)
    }

    static func httpFrameURL(from raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let url = URL(string: trimmed), isHttpFrameURL(url) {
            return normalizeFrameURL(url)
        }

        guard let url = URL(string: trimmed), let host = url.host else { return nil }
        var comps = URLComponents()
        comps.scheme = "http"
        comps.host = host
        comps.port = framePort
        comps.path = "/frame.jpg"
        return comps.url
    }

    static func playbackCandidates(for raw: String) -> [URL] {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        var seen = Set<String>()
        var result: [URL] = []

        func append(_ url: URL?) {
            guard let url, seen.insert(url.absoluteString).inserted else { return }
            result.append(url)
        }

        if let primary = URL(string: trimmed) {
            if isHttpFrameURL(primary) {
                append(normalizeFrameURL(primary))
                return result
            }
            append(normalizeHLS(primary))
            if primary.scheme?.lowercased() == "rtsp" {
                append(hlsFallback(from: primary))
            }
        }

        return result
    }

    private static func isHttpFrameURL(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "http" else { return false }
        if url.port == framePort { return true }
        return url.path.hasSuffix("/frame.jpg") || url.path == "frame.jpg"
    }

    private static func normalizeFrameURL(_ url: URL) -> URL {
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        if comps.port == nil { comps.port = framePort }
        if comps.path.isEmpty || comps.path == "/" {
            comps.path = "/frame.jpg"
        } else if !comps.path.hasSuffix("frame.jpg") {
            comps.path = comps.path.hasSuffix("/") ? comps.path + "frame.jpg" : comps.path + "/frame.jpg"
        }
        return comps.url ?? url
    }

    private static func normalizeHLS(_ url: URL) -> URL {
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.scheme?.lowercased() == "http",
              !comps.path.isEmpty,
              !comps.path.hasSuffix(".m3u8"),
              !isHttpFrameURL(url) else { return url }

        comps.path = comps.path.hasSuffix("/") ? comps.path + "index.m3u8" : comps.path + "/index.m3u8"
        return comps.url ?? url
    }

    private static func hlsFallback(from rtsp: URL) -> URL? {
        guard var comps = URLComponents(url: rtsp, resolvingAgainstBaseURL: false) else { return nil }
        comps.scheme = "http"
        comps.port = 8888
        var path = comps.path
        if !path.hasSuffix(".m3u8") {
            path = path.hasSuffix("/") ? path + "index.m3u8" : path + "/index.m3u8"
        }
        comps.path = path
        return comps.url
    }
}