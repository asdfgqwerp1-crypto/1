import UIKit

/// Polls a low-latency HTTP JPEG endpoint (no HLS buffer).
final class HttpSnapshotPlayer: NSObject {
    var onJPEG: ((Data) -> Void)?

    private let session: URLSession
    private var timer: DispatchSourceTimer?
    private var pollQueue = DispatchQueue(label: "com.safarispoof.http.snapshot")
    private var isFetching = false
    private var frameURL: URL?
    private var previewImageView: UIImageView?
    private var lastErrorLog: CFAbsoluteTime = 0
    private var fetchSuccessCount = 0
    private var lastPayloadDigest = 0
    private var lastPayloadChangeTime: CFAbsoluteTime = 0
    private var lastStaleLogTime: CFAbsoluteTime = 0

    override init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 2
        config.timeoutIntervalForResource = 2
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        session = URLSession(configuration: config)
        super.init()
    }

    func play(url: URL) {
        stop()
        frameURL = url
        fetchSuccessCount = 0
        lastPayloadDigest = 0
        lastPayloadChangeTime = 0
        lastStaleLogTime = 0
        DispatchQueue.main.async {
            DebugLogStore.shared.append(level: "info", message: "[http] start poll \(url.absoluteString)")
        }
        let timer = DispatchSource.makeTimerSource(queue: pollQueue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(33), leeway: .milliseconds(2))
        timer.setEventHandler { [weak self] in
            self?.fetchLatest()
        }
        timer.resume()
        self.timer = timer
        fetchLatest()
    }

    func attachPreview(to view: UIView) {
        previewImageView?.removeFromSuperview()
        let imageView = UIImageView(frame: view.bounds)
        imageView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.backgroundColor = .black
        view.insertSubview(imageView, at: 0)
        previewImageView = imageView
    }

    func updatePreviewLayout(in view: UIView) {
        guard view.bounds.width > 1, view.bounds.height > 1 else { return }
        previewImageView?.frame = view.bounds
    }

    func stop() {
        timer?.cancel()
        timer = nil
        isFetching = false
        frameURL = nil
        previewImageView?.removeFromSuperview()
        previewImageView = nil
    }

    private func fetchLatest() {
        guard let frameURL, !isFetching else { return }
        isFetching = true
        var request = URLRequest(url: cacheBustedURL(frameURL))
        request.cachePolicy = .reloadIgnoringLocalCacheData
        session.dataTask(with: request) { [weak self] data, response, error in
            defer { self?.isFetching = false }
            guard let self else { return }
            if let error {
                self.logFetchIssue("error: \(error.localizedDescription)")
                return
            }
            guard let data, !data.isEmpty else {
                self.logFetchIssue("empty body")
                return
            }
            guard let http = response as? HTTPURLResponse else {
                self.logFetchIssue("non-http response")
                return
            }
            guard http.statusCode == 200 else {
                self.logFetchIssue("HTTP \(http.statusCode)")
                return
            }
            self.fetchSuccessCount += 1
            self.notePayloadFreshness(data, response: http)
            if self.fetchSuccessCount == 1 {
                DispatchQueue.main.async {
                    DebugLogStore.shared.append(
                        level: "info",
                        message: "[http] first frame bytes=\(data.count)"
                    )
                }
            }
            DispatchQueue.main.async {
                self.previewImageView?.image = UIImage(data: data)
                self.onJPEG?(data)
            }
        }.resume()
    }

    private func notePayloadFreshness(_ data: Data, response: HTTPURLResponse) {
        let digest = data.hashValue
        let now = CFAbsoluteTimeGetCurrent()
        if digest != lastPayloadDigest {
            lastPayloadDigest = digest
            lastPayloadChangeTime = now
            return
        }
        guard now - lastPayloadChangeTime >= 3, now - lastStaleLogTime >= 3 else { return }
        lastStaleLogTime = now
        let relaySeq = response.value(forHTTPHeaderField: "X-Relay-Seq") ?? "?"
        let relayAge = response.value(forHTTPHeaderField: "X-Relay-Age-Ms") ?? "?"
        DispatchQueue.main.async {
            DebugLogStore.shared.append(
                level: "warn",
                message: "[http] stale frame unchanged >3s bytes=\(data.count) relaySeq=\(relaySeq) ageMs=\(relayAge) — restart OBS stream or frame relay"
            )
        }
    }

    private func logFetchIssue(_ detail: String) {
        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastErrorLog > 2 else { return }
        lastErrorLog = now
        let urlText = frameURL?.absoluteString ?? "?"
        DispatchQueue.main.async {
            DebugLogStore.shared.append(level: "warn", message: "[http] \(detail) url=\(urlText)")
        }
    }

    private func cacheBustedURL(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        var items = components.queryItems ?? []
        items.removeAll { $0.name == "t" }
        items.append(URLQueryItem(name: "t", value: String(UInt64(Date().timeIntervalSince1970 * 1000))))
        components.queryItems = items
        return components.url ?? url
    }
}