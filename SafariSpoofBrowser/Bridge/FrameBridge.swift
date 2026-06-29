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

    let schemeHandler = FrameSchemeHandler()

    weak var delegate: FrameBridgeDelegate?

    private let metricsSubject = CurrentValueSubject<FrameBridgeMetrics, Never>(FrameBridgeMetrics())
    var metricsPublisher: AnyPublisher<FrameBridgeMetrics, Never> {
        metricsSubject.eraseToAnyPublisher()
    }

    private weak var webView: WKWebView?
    private var frameTimestamps: [CFAbsoluteTime] = []
    private var metrics = FrameBridgeMetrics()
    private(set) var isDeliveryEnabled = false
    private var lastSendTime: CFAbsoluteTime = 0
    private var hasStartedPoll = false
    private let minInterval: CFAbsoluteTime = 1.0 / 8.0

    var isDelivering: Bool { isDeliveryEnabled }

    func registerScheme(on configuration: WKWebViewConfiguration) {
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: FrameSchemeHandler.scheme)
    }

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
            hasStartedPoll = false
            schemeHandler.clearFrame()
        }
    }

    func sendFrame(jpegData: Data, width: Int, height: Int, timestamp: CFAbsoluteTime) {
        guard isDeliveryEnabled else { return }
        guard jpegData.count < 180_000 else { return }

        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastSendTime >= minInterval else { return }

        lastSendTime = now
        let latency = (now - timestamp) * 1000
        schemeHandler.updateFrame(jpegData)
        updateMetrics(latency: latency)
        notifyStartFramePollIfNeeded()
    }

    private func notifyStartFramePollIfNeeded() {
        guard !hasStartedPoll, let webView else { return }
        hasStartedPoll = true
        DispatchQueue.main.async {
            webView.evaluateJavaScript(
                "window.__spoofStartFramePoll && window.__spoofStartFramePoll();",
                completionHandler: nil
            )
        }
    }

    private func notifyStopFramePoll() {
        hasStartedPoll = false
        guard let webView else { return }
        DispatchQueue.main.async {
            webView.evaluateJavaScript(
                "window.__spoofStopFramePoll && window.__spoofStopFramePoll();",
                completionHandler: nil
            )
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
            hasStartedPoll = false
            schemeHandler.clearFrame()
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStart()
            }
        case "stopStream":
            isDeliveryEnabled = false
            schemeHandler.clearFrame()
            notifyStopFramePoll()
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStop()
            }
        default:
            break
        }
    }
}