import Foundation
import WebKit

/// CSP-safe control transport (Regula blocks custom URL schemes in connect-src / frame-src).
final class SpoofControlMessageHandler: NSObject, WKScriptMessageHandler {
    static let handlerName = "ssbControl"

    weak var frameBridge: FrameBridge?
    weak var exportBridge: ExportBridge?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any] else { return }

        if let key = body["k"] as? String, !SchemeAuthValidator.authKey.isEmpty, key != SchemeAuthValidator.authKey {
            return
        }

        let path = (body["path"] as? String) ?? ""
        let params = (body["params"] as? [String: Any]) ?? [:]

        if path == "debug/log" || path.hasPrefix("debug/") {
            handleDebugLog(params)
            return
        }

        if path == "export" {
            handleExport(params)
            return
        }

        if path == "stream/start" || path.hasPrefix("stream/") {
            var control: [String: Any] = ["event": "startStream"]
            params.forEach { key, value in
                control[key] = value
            }
            DispatchQueue.main.async { [weak self] in
                self?.frameBridge?.handleControlMessage(control)
            }
            return
        }

        if path == "stream/stop" {
            DispatchQueue.main.async { [weak self] in
                self?.frameBridge?.handleControlMessage(["event": "stopStream"])
            }
            return
        }
    }

    private func handleDebugLog(_ payload: [String: Any]) {
        let level = (payload["level"] as? String) ?? "log"
        let message = (payload["message"] as? String) ?? ""
        let source = payload["source"] as? String
        let composed = source.map { "[\($0)] \(message)" } ?? message
        Task { @MainActor in
            DebugLogStore.shared.append(level: level, message: composed)
        }
    }

    private func handleExport(_ payload: [String: Any]) {
        guard let json = payload["json"] as? String else { return }
        let filename = (payload["filename"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "report.json"
        DispatchQueue.main.async { [weak self] in
            self?.exportBridge?.handleExport(filename: filename, json: json)
        }
    }
}