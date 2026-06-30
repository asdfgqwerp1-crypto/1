import Foundation
import WebKit

final class ControlSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "spoofcontrol"

    weak var frameBridge: FrameBridge?
    weak var exportBridge: ExportBridge?

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            fail(task: urlSchemeTask, code: 400, message: "Missing URL")
            return
        }

        guard SchemeAuthValidator.isAuthorized(url) else {
            DispatchQueue.main.async {
                urlSchemeTask.didFailWithError(SchemeAuthValidator.unauthorizedError)
            }
            return
        }

        let route = Self.parseRoute(url)
        switch route.kind {
        case "export":
            handleExport(task: urlSchemeTask, request: urlSchemeTask.request, url: url)
        case "debug":
            handleDebugLog(task: urlSchemeTask, request: urlSchemeTask.request)
        case "stream":
            switch route.action {
            case "start":
                handleStreamStart(task: urlSchemeTask, url: url)
            case "stop":
                handleStreamStop(task: urlSchemeTask)
            default:
                fail(task: urlSchemeTask, code: 404, message: "Unknown stream action")
            }
        default:
            fail(task: urlSchemeTask, code: 404, message: "Unknown control route")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func parseRoute(_ url: URL) -> (kind: String, action: String) {
        let host = (url.host ?? "").lowercased()
        var path = url.path.lowercased()
        if path.hasPrefix("/") {
            path = String(path.dropFirst())
        }

        if host == "export" || path == "export" {
            return ("export", "")
        }

        if host == "debug" || path.hasPrefix("debug/") || path == "debug" {
            let action = host == "debug"
                ? (path.isEmpty ? "log" : path)
                : String(path.dropFirst("debug/".count))
            return ("debug", action.isEmpty ? "log" : action)
        }

        if host == "stream" {
            return ("stream", path.isEmpty ? "start" : path)
        }

        if path.hasPrefix("stream/") {
            return ("stream", String(path.dropFirst("stream/".count)))
        }

        if path == "start" || path.hasSuffix("/start") {
            return ("stream", "start")
        }

        if path == "stop" || path.hasSuffix("/stop") {
            return ("stream", "stop")
        }

        return ("", "")
    }

    private func handleStreamStart(task: WKURLSchemeTask, url: URL) {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        var params: [String: Any] = ["event": "startStream"]
        components?.queryItems?.forEach { item in
            guard let value = item.value else { return }
            switch item.name {
            case "width", "height":
                if let intValue = Int(value) {
                    params[item.name] = intValue
                }
            case "frameRate":
                if let doubleValue = Double(value) {
                    params[item.name] = doubleValue
                }
            default:
                break
            }
        }
        DispatchQueue.main.async { [weak self] in
            self?.frameBridge?.handleControlMessage(params)
            self?.respondOK(task: task)
        }
    }

    private func handleStreamStop(task: WKURLSchemeTask) {
        DispatchQueue.main.async { [weak self] in
            self?.frameBridge?.handleControlMessage(["event": "stopStream"])
            self?.respondOK(task: task)
        }
    }

    private func handleExport(task: WKURLSchemeTask, request: URLRequest, url: URL) {
        var filename = "report.json"
        var json: String?

        if let body = request.httpBody, !body.isEmpty {
            json = String(data: body, encoding: .utf8)
        } else if let stream = request.httpBodyStream {
            json = String(data: Data(reading: stream), encoding: .utf8)
        }

        if let currentJson = json,
           let data = currentJson.data(using: .utf8),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let nested = object["json"] as? String {
                json = nested
            }
            if let name = object["filename"] as? String, !name.isEmpty {
                filename = name
            }
        }

        if json == nil {
            if let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
                components.queryItems?.forEach { item in
                    if item.name == "filename", let value = item.value, !value.isEmpty {
                        filename = value
                    }
                }
            }
            if let fragment = url.fragment, !fragment.isEmpty {
                json = fragment.removingPercentEncoding ?? fragment
            }
        }

        guard let exportJson = json else {
            fail(task: task, code: 400, message: "Missing export payload")
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.exportBridge?.handleExport(filename: filename, json: exportJson)
            self?.respondOK(task: task)
        }
    }

    private func handleDebugLog(task: WKURLSchemeTask, request: URLRequest) {
        var payload: [String: Any] = [:]

        if let body = request.httpBody, !body.isEmpty,
           let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any] {
            payload = object
        } else if let stream = request.httpBodyStream,
                  let body = String(data: Data(reading: stream), encoding: .utf8),
                  let data = body.data(using: .utf8),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            payload = object
        }

        if payload["message"] == nil,
           let url = request.url,
           let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            for item in items where item.name != "k" {
                guard let value = item.value else { continue }
                let decoded = value.removingPercentEncoding ?? value
                switch item.name {
                case "level", "message", "source":
                    payload[item.name] = decoded
                default:
                    break
                }
            }
        }

        let level = (payload["level"] as? String) ?? "log"
        let message = (payload["message"] as? String) ?? ""
        let source = payload["source"] as? String
        let composed = source.map { "[\($0)] \(message)" } ?? message

        DispatchQueue.main.async {
            Task { @MainActor in
                DebugLogStore.shared.append(level: level, message: composed)
            }
            self.respondOK(task: task)
        }
    }

    private func respondOK(task: WKURLSchemeTask) {
        guard let url = task.request.url,
              let response = HTTPURLResponse(
                url: url,
                statusCode: 204,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Length": "0",
                    "Cache-Control": "no-store"
                ]
              ) else {
            fail(task: task, code: 500, message: "Bad response")
            return
        }
        task.didReceive(response)
        task.didFinish()
    }

    private func fail(task: WKURLSchemeTask, code: Int, message: String) {
        DispatchQueue.main.async {
            let error = NSError(
                domain: Self.scheme,
                code: code,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
            task.didFailWithError(error)
        }
    }
}

private extension Data {
    init(reading stream: InputStream) {
        self.init()
        stream.open()
        defer { stream.close() }
        let bufferSize = 16_384
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            append(buffer, count: read)
        }
    }
}