import Foundation
import WebKit

final class FrameSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "spoofframe"
    static let nv12ContentType = "application/vnd.safarispoof.nv12"
    static let jpegContentType = "image/jpeg"
    static let exposeHeaders = [
        "Content-Type",
        "X-Frame-Format",
        "X-Frame-Chunks",
        "X-Frame-Seq",
        "X-Frame-PTS-Us",
        "X-Frame-Width",
        "X-Frame-Height",
        "X-Frame-Part",
        "X-Frame-Part-Count"
    ].joined(separator: ",")

    private let queue = DispatchQueue(label: "com.safarispoof.frame.scheme")
    private var latestFrame: SpoofFrame?
    private var latestChunked: ChunkedNV12Frame?

    func updateFrame(_ frame: SpoofFrame) {
        queue.async { [weak self] in
            self?.latestChunked = nil
            self?.latestFrame = frame
        }
    }

    func updateChunkedNV12(_ chunked: ChunkedNV12Frame) {
        queue.async { [weak self] in
            self?.latestChunked = chunked
            self?.latestFrame = chunked.metaFrame()
        }
    }

    func clearFrame() {
        queue.async { [weak self] in
            self?.latestFrame = nil
            self?.latestChunked = nil
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        queue.async { [weak self] in
            guard let self else { return }
            guard let url = urlSchemeTask.request.url else {
                self.failOnMain(task: urlSchemeTask, code: 400, message: "Missing URL")
                return
            }
            self.respondOnMain(task: urlSchemeTask, url: url)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respondOnMain(task: WKURLSchemeTask, url: URL) {
        DispatchQueue.main.async { [self] in
            if isPartRequest(url) {
                respondPart(task: task, url: url)
                return
            }
            let frame = latestFrame ?? Self.placeholderFrame()
            let chunked = latestChunked
            if frame.format == .nv12, let chunked, chunked.chunkCount > 1 {
                respond(task: task, url: url, data: Data(), frame: frame, chunkCount: chunked.chunkCount, partIndex: nil)
                return
            }
            respond(task: task, url: url, data: frame.data, frame: frame, chunkCount: 1, partIndex: nil)
        }
    }

    private func respondPart(task: WKURLSchemeTask, url: URL) {
        guard let chunked = latestChunked else {
            failOnMain(task: task, code: 404, message: "No chunked frame")
            return
        }

        let seq = queryUInt64(url, name: "seq") ?? 0
        let partIndex = queryInt(url, name: "p") ?? -1

        guard seq == chunked.sequence, partIndex >= 0, partIndex < chunked.chunkCount else {
            failOnMain(task: task, code: 404, message: "Chunk not found")
            return
        }

        let frame = chunked.metaFrame()
        respond(
            task: task,
            url: url,
            data: chunked.chunks[partIndex],
            frame: frame,
            chunkCount: chunked.chunkCount,
            partIndex: partIndex
        )
    }

    private func respond(
        task: WKURLSchemeTask,
        url: URL,
        data: Data,
        frame: SpoofFrame,
        chunkCount: Int,
        partIndex: Int?
    ) {
        let contentType = frame.format == .nv12 ? Self.nv12ContentType : Self.jpegContentType
        let formatLabel = frame.format == .nv12 ? "nv12" : "jpeg"
        var headers = [
            "Content-Type": contentType,
            "Content-Length": "\(data.count)",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Expose-Headers": Self.exposeHeaders,
            "Cross-Origin-Resource-Policy": "cross-origin",
            "X-Frame-Format": formatLabel,
            "X-Frame-Width": "\(frame.width)",
            "X-Frame-Height": "\(frame.height)",
            "X-Frame-Seq": "\(frame.sequence)",
            "X-Frame-PTS-Us": "\(frame.presentationTimeUs)",
            "X-Frame-Chunks": "\(chunkCount)"
        ]
        if let partIndex {
            headers["X-Frame-Part"] = "\(partIndex)"
            headers["X-Frame-Part-Count"] = "\(chunkCount)"
        }
        guard let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            failOnMain(task: task, code: 500, message: "Bad response")
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private func isPartRequest(_ url: URL) -> Bool {
        if url.path == "/part" || url.path.hasSuffix("/part") { return true }
        if url.host == "part" { return true }
        return url.absoluteString.contains("/part")
    }

    private func queryInt(_ url: URL, name: String) -> Int? {
        guard let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == name })?
            .value else { return nil }
        return Int(value)
    }

    private func queryUInt64(_ url: URL, name: String) -> UInt64? {
        guard let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == name })?
            .value else { return nil }
        return UInt64(value)
    }

    private func failOnMain(task: WKURLSchemeTask, code: Int, message: String) {
        DispatchQueue.main.async {
            let error = NSError(domain: "spoofframe", code: code, userInfo: [NSLocalizedDescriptionKey: message])
            task.didFailWithError(error)
        }
    }

    private static func placeholderFrame() -> SpoofFrame {
        SpoofFrame(
            data: placeholderJPEG(),
            format: .jpeg,
            width: 2,
            height: 2,
            sequence: 0,
            presentationTimeUs: 0
        )
    }

    private static func placeholderJPEG() -> Data {
        Data([
            0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
            0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27,
            0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34,
            0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B,
            0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00,
            0x00, 0x3F, 0x00, 0x7F, 0xFF, 0xD9
        ])
    }
}