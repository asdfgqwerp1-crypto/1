import Foundation
import WebKit

final class FrameSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "spoofframe"
    static let nv12ContentType = "application/vnd.safarispoof.nv12"
    static let jpegContentType = "image/jpeg"

    private let queue = DispatchQueue(label: "com.safarispoof.frame.scheme")
    private var latestFrame: SpoofFrame?

    func updateFrame(_ frame: SpoofFrame) {
        queue.async { [weak self] in
            self?.latestFrame = frame
        }
    }

    func clearFrame() {
        queue.async { [weak self] in
            self?.latestFrame = nil
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        queue.async { [weak self] in
            guard let self else { return }
            guard let url = urlSchemeTask.request.url else {
                self.failOnMain(task: urlSchemeTask, code: 400, message: "Missing URL")
                return
            }

            let frame = self.latestFrame ?? Self.placeholderFrame()
            self.respondOnMain(task: urlSchemeTask, url: url, frame: frame)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respondOnMain(task: WKURLSchemeTask, url: URL, frame: SpoofFrame) {
        DispatchQueue.main.async {
            let contentType = frame.format == .nv12 ? Self.nv12ContentType : Self.jpegContentType
            let formatLabel = frame.format == .nv12 ? "nv12" : "jpeg"
            let headers = [
                "Content-Type": contentType,
                "Content-Length": "\(frame.data.count)",
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Expose-Headers": "Content-Type,X-Frame-Format,X-Frame-Seq,X-Frame-PTS-Us,X-Frame-Width,X-Frame-Height",
                "Cross-Origin-Resource-Policy": "cross-origin",
                "X-Frame-Format": formatLabel,
                "X-Frame-Width": "\(frame.width)",
                "X-Frame-Height": "\(frame.height)",
                "X-Frame-Seq": "\(frame.sequence)",
                "X-Frame-PTS-Us": "\(frame.presentationTimeUs)"
            ]
            guard let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: headers
            ) else {
                self.failOnMain(task: task, code: 500, message: "Bad response")
                return
            }
            task.didReceive(response)
            task.didReceive(frame.data)
            task.didFinish()
        }
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