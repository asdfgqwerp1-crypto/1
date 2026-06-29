import Foundation

enum StreamURLResolver {
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
            append(normalizeHTTP(primary))
            if primary.scheme?.lowercased() == "rtsp" {
                append(hlsFallback(from: primary))
            }
        }

        return result
    }

    private static func normalizeHTTP(_ url: URL) -> URL {
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.scheme?.lowercased() == "http",
              !comps.path.isEmpty,
              !comps.path.hasSuffix(".m3u8") else { return url }

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