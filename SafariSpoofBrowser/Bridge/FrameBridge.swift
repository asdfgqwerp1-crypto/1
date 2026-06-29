import Foundation
import WebKit
import Combine

struct FrameBridgeMetrics: Equatable {
    var fps: Double = 0
    var latencyMs: Double = 0
    var framesSent: Int = 0
}

final class FrameBridge: NSObject {
    static let handlerName = "spoofFrameBridge"

    private let metricsSubject = CurrentValueSubject<FrameBridgeMetrics, Never>(FrameBridgeMetrics())
    var metricsPublisher: AnyPublisher<FrameBridgeMetrics, Never> {
        metricsSubject.eraseToAnyPublisher()
    }

    private weak var webView: WKWebView?
    private var lastFrameTime: CFAbsoluteTime = 0
    private var frameTimestamps: [CFAbsoluteTime] = []
    private var metrics = FrameBridgeMetrics()

    func register(with controller: WKUserContentController) {
        controller.add(self, name: Self.handlerName)
    }

    func unregister(from controller: WKUserContentController) {
        controller.removeScriptMessageHandler(forName: Self.handlerName)
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func sendFrame(base64JPEG: String, width: Int, height: Int, timestamp: CFAbsoluteTime) {
        guard let webView else { return }

        let latency = (CFAbsoluteTimeGetCurrent() - timestamp) * 1000
        updateMetrics(latency: latency)

        let escaped = base64JPEG.replacingOccurrences(of: "'", with: "\\'")
        let js = "window.__spoofReceiveFrame && window.__spoofReceiveFrame('\(escaped)', \(width), \(height));"

        DispatchQueue.main.async {
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func updateMetrics(latency: Double) {
        let now = CFAbsoluteTimeGetCurrent()
        frameTimestamps.append(now)
        frameTimestamps = frameTimestamps.filter { now - $0 <= 1.0 }

        metrics.framesSent += 1
        metrics.latencyMs = latency
        metrics.fps = Double(frameTimestamps.count)
        metricsSubject.send(metrics)
    }
}

extension FrameBridge: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Reserved for JS → native messages (e.g. stream started, errors)
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let event = body["event"] as? String else { return }

        if event == "streamStarted" {
            metrics = FrameBridgeMetrics()
            metricsSubject.send(metrics)
        }
    }
}