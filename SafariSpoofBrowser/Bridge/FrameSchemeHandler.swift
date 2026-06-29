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

            guard let data = self.latestJPEG, !data.isEmpty else {
                self.fail(task: urlSchemeTask, code: 404, message: "No frame available")
                self.activeTasks.removeValue(forKey: taskID)
                return
            }

            guard let url = urlSchemeTask.request.url else {
                self.fail(task: urlSchemeTask, code: 400, message: "Missing URL")
                self.activeTasks.removeValue(forKey: taskID)
                return
            }

            let response = URLResponse(
                url: url,
                mimeType: "image/jpeg",
                expectedContentLength: data.count,
                textEncodingName: nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
            self.activeTasks.removeValue(forKey: taskID)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        queue.async { [weak self] in
            self?.activeTasks.removeValue(forKey: ObjectIdentifier(urlSchemeTask))
        }
    }

    private func fail(task: WKURLSchemeTask, code: Int, message: String) {
        let error = NSError(domain: "spoofframe", code: code, userInfo: [NSLocalizedDescriptionKey: message])
        task.didFailWithError(error)
    }
}