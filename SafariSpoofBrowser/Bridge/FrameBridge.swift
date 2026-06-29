import Foundation
import WebKit
import Combine

struct FrameBridgeMetrics: Equatable {
    var fps: Double = 0
    var latencyMs: Double = 0
    var framesSent: Int = 0
}

protocol FrameBridgeDelegate: AnyObject {
    func frameBridgeDidRequestStreamStart()
    func frameBridgeDidRequestStreamStop()
}

final class FrameBridge: NSObject {
    static let handlerName = "spoofFrameBridge"

    weak var delegate: FrameBridgeDelegate?

    private let metricsSubject = CurrentValueSubject<FrameBridgeMetrics, Never>(FrameBridgeMetrics())
    var metricsPublisher: AnyPublisher<FrameBridgeMetrics, Never> {
        metricsSubject.eraseToAnyPublisher()
    }

    private weak var webView: WKWebView?
    private var frameTimestamps: [CFAbsoluteTime] = []
    private var metrics = FrameBridgeMetrics()
    private var isDeliveryEnabled = false
    private var lastSendTime: CFAbsoluteTime = 0
    private let minInterval: CFAbsoluteTime = 1.0 / 12.0
    private var isEvaluating = false
    private var pendingFrame: (base64: String, width: Int, height: Int)?

    func register(with controller: WKUserContentController) {
        controller.add(self, name: Self.handlerName)
    }

    func unregister(from controller: WKUserContentController) {
        controller.removeScriptMessageHandler(forName: Self.handlerName)
    }

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func setDeliveryEnabled(_ enabled: Bool) {
        isDeliveryEnabled = enabled
        if !enabled {
            pendingFrame = nil
        }
    }

    func sendFrame(base64JPEG: String, width: Int, height: Int, timestamp: CFAbsoluteTime) {
        guard isDeliveryEnabled, let webView else { return }
        guard base64JPEG.count < 120_000 else { return }

        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastSendTime >= minInterval else { return }

        if isEvaluating {
            pendingFrame = (base64JPEG, width, height)
            return
        }

        lastSendTime = now
        let latency = (now - timestamp) * 1000
        updateMetrics(latency: latency)
        dispatchFrame(base64JPEG: base64JPEG, width: width, height: height, on: webView)
    }

    private func dispatchFrame(base64JPEG: String, width: Int, height: Int, on webView: WKWebView) {
        isEvaluating = true
        let script = """
        (function(){
          if (window.__spoofReceiveFrame) {
            window.__spoofReceiveFrame('\(base64JPEG.escapedForJS())', \(width), \(height));
          }
        })();
        """

        DispatchQueue.main.async { [weak self] in
            webView.evaluateJavaScript(script) { _, _ in
                guard let self else { return }
                self.isEvaluating = false
                if let pending = self.pendingFrame {
                    self.pendingFrame = nil
                    self.sendFrame(
                        base64JPEG: pending.base64,
                        width: pending.width,
                        height: pending.height,
                        timestamp: CFAbsoluteTimeGetCurrent()
                    )
                }
            }
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
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let event = body["event"] as? String else { return }

        switch event {
        case "startStream":
            isDeliveryEnabled = true
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStart()
            }
        case "stopStream":
            isDeliveryEnabled = false
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStop()
            }
        default:
            break
        }
    }
}

private extension String {
    func escapedForJS() -> String {
        replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
    }
}

