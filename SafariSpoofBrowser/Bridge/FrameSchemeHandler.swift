import Foundation
import WebKit

final class FrameSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "spoofframe"

    private let queue = DispatchQueue(label: "com.safarispoof.frame.scheme")
    private var latestJPEG: Data?
    private var activeTasks: [ObjectIdentifier: WKURLSchemeTask] = [:]

    func updateFrame(_ jpegData: Data) {
        queue.async { [weak self] in
            self?.latestJPEG = jpegData
        }
    }

    func clearFrame() {
        queue.async { [weak self] in
            self?.latestJPEG = nil
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        queue.async { [weak self] in
            guard let self else { return }
            let taskID = ObjectIdentifier(urlSchemeTask)
            self.activeTasks[taskID] = urlSchemeTask

            guard let url = urlSchemeTask.request.url else {
                self.fail(task: urlSchemeTask, code: 400, message: "Missing URL")
                self.activeTasks.removeValue(forKey: taskID)
                return
            }

            guard let data = self.latestJPEG, !data.isEmpty else {
                self.respond(task: urlSchemeTask, url: url, data: Self.placeholderJPEG())
                self.activeTasks.removeValue(forKey: taskID)
                return
            }

            self.respond(task: urlSchemeTask, url: url, data: data)
            self.activeTasks.removeValue(forKey: taskID)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        queue.async { [weak self] in
            self?.activeTasks.removeValue(forKey: ObjectIdentifier(urlSchemeTask))
        }
    }

    private func respond(task: WKURLSchemeTask, url: URL, data: Data) {
        let headers = [
            "Content-Type": "image/jpeg",
            "Content-Length": "\(data.count)",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*"
        ]
        guard let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            fail(task: task, code: 500, message: "Bad response")
            return
        }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private func fail(task: WKURLSchemeTask, code: Int, message: String) {
        let error = NSError(domain: "spoofframe", code: code, userInfo: [NSLocalizedDescriptionKey: message])
        task.didFailWithError(error)
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