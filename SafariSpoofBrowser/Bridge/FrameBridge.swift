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

    private var frameTimestamps: [CFAbsoluteTime] = []
    private var metrics = FrameBridgeMetrics()
    private(set) var isDeliveryEnabled = false
    private var lastSendTime: CFAbsoluteTime = 0
    private let minInterval: CFAbsoluteTime = 1.0 / 12.0

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

    func setDeliveryEnabled(_ enabled: Bool) {
        isDeliveryEnabled = enabled
        if !enabled {
            schemeHandler.clearFrame()
        }
    }

    func sendFrame(jpegData: Data, width: Int, height: Int, timestamp: CFAbsoluteTime) {
        guard isDeliveryEnabled else { return }
        guard jpegData.count < 200_000 else { return }

        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastSendTime >= minInterval else { return }

        lastSendTime = now
        let latency = (now - timestamp) * 1000
        schemeHandler.updateFrame(jpegData)
        updateMetrics(latency: latency)
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
            schemeHandler.clearFrame()
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStop()
            }
        default:
            break
        }
    }
}