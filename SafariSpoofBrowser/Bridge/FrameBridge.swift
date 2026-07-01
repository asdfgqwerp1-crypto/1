import Foundation
import WebKit
import Combine

struct FrameBridgeMetrics: Equatable {
    var fps: Double = 0
    var latencyMs: Double = 0
    var framesSent: Int = 0
}

@MainActor
protocol FrameBridgeDelegate: AnyObject {
    func frameBridgeDidRequestStreamStart(config: StreamDeliveryConfig?)
    func frameBridgeDidRequestStreamStop()
}

final class FrameBridge: NSObject {
    static let maxNV12PayloadBytes = 600_000
    static let maxJPEGPayloadBytes = 400_000

    let schemeHandler = FrameSchemeHandler()
    let controlSchemeHandler = ControlSchemeHandler()

    weak var delegate: FrameBridgeDelegate?

    private let metricsSubject = CurrentValueSubject<FrameBridgeMetrics, Never>(FrameBridgeMetrics())
    var metricsPublisher: AnyPublisher<FrameBridgeMetrics, Never> {
        metricsSubject.eraseToAnyPublisher()
    }

    private weak var webView: WKWebView?
    private let attachedWebViews = NSHashTable<WKWebView>.weakObjects()
    private weak var deliveryWebView: WKWebView?
    private var deliveryFrame: WKFrameInfo?
    private var frameTimestamps: [CFAbsoluteTime] = []
    private var metrics = FrameBridgeMetrics()
    private(set) var isDeliveryEnabled = false
    private var lastSendTime: CFAbsoluteTime = 0
    private var hasStartedPoll = false
    private var frameTiming = FrameTiming.iphoneDefault
    private var sendFrameIndex: UInt64 = 0

    var isDelivering: Bool { isDeliveryEnabled }

    override init() {
        super.init()
        controlSchemeHandler.frameBridge = self
    }

    func registerSchemes(on configuration: WKWebViewConfiguration) {
        configuration.setURLSchemeHandler(schemeHandler, forURLScheme: FrameSchemeHandler.scheme)
        configuration.setURLSchemeHandler(controlSchemeHandler, forURLScheme: ControlSchemeHandler.scheme)
    }

    func attach(webView: WKWebView) {
        attachedWebViews.add(webView)
        self.webView = webView
    }

    func setStreamDeliveryTarget(webView: WKWebView?, frame: WKFrameInfo?) {
        deliveryWebView = webView
        deliveryFrame = frame
        guard let frame else { return }
        let host = Self.host(for: frame)
        DispatchQueue.main.async {
            DebugLogStore.shared.append(
                level: "info",
                message: "[native] delivery frame main=\(frame.isMainFrame) host=\(host)"
            )
        }
    }

    private var allAttachedWebViews: [WKWebView] {
        attachedWebViews.allObjects
    }

    private static func host(for frame: WKFrameInfo?) -> String {
        guard let frame else { return "main" }
        return frame.request.url.host ?? "main"
    }

    func setSchemeAuthKey(_ key: String) {
        SchemeAuthValidator.setAuthKey(key)
    }

    func setDeliveryEnabled(_ enabled: Bool) {
        isDeliveryEnabled = enabled
        if !enabled {
            hasStartedPoll = false
        }
    }

    func handleControlMessage(_ body: [String: Any]) {
        guard let event = body["event"] as? String else { return }

        switch event {
        case "startStream":
            isDeliveryEnabled = true
            hasStartedPoll = false
            sendFrameIndex = 0
            schemeHandler.clearFrame()
            let streamConfig = Self.parseStreamConfig(from: body)
            if let frameRate = streamConfig?.frameRate {
                frameTiming = FrameTiming(
                    targetFrameRate: frameRate,
                    minDeliverFps: frameTiming.minDeliverFps,
                    jitterMsMin: frameTiming.jitterMsMin,
                    jitterMsMax: frameTiming.jitterMsMax,
                    exposureHitchInterval: frameTiming.exposureHitchInterval,
                    exposureHitchMsMin: frameTiming.exposureHitchMsMin,
                    exposureHitchMsMax: frameTiming.exposureHitchMsMax,
                    slowdownProbability: frameTiming.slowdownProbability,
                    slowdownFactorMin: frameTiming.slowdownFactorMin,
                    slowdownFactorMax: frameTiming.slowdownFactorMax
                )
            }
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStart(config: streamConfig)
            }
        case "stopStream":
            deliveryWebView = nil
            deliveryFrame = nil
            // Keep delivery enabled — network ingest should keep filling spoofframe buffer.
            notifyStopFramePoll()
            DispatchQueue.main.async { [weak self] in
                self?.delegate?.frameBridgeDidRequestStreamStop()
            }
        default:
            break
        }
    }

    func sendFrame(
        data: Data,
        format: SpoofFrameFormat,
        width: Int,
        height: Int,
        sequence: UInt64,
        presentationTimeUs: UInt64,
        captureTimestamp: CFAbsoluteTime,
        jpegMirror: Data? = nil
    ) {
        guard isDeliveryEnabled else { return }
        let maxBytes = format == .nv12 ? Self.maxNV12PayloadBytes : Self.maxJPEGPayloadBytes
        guard data.count <= maxBytes else { return }

        let now = CFAbsoluteTimeGetCurrent()
        let interval = frameTiming.nextIntervalSeconds(frameIndex: sendFrameIndex)
        guard now - lastSendTime >= interval else { return }

        lastSendTime = now
        sendFrameIndex &+= 1
        let latency = (now - captureTimestamp) * 1000

        if format == .nv12 {
            let chunked = ChunkedNV12Frame(
                sequence: sequence,
                width: width,
                height: height,
                presentationTimeUs: presentationTimeUs,
                data: data
            )
            let mirrorFrame = jpegMirror.map {
                SpoofFrame(
                    data: $0,
                    format: .jpeg,
                    width: width,
                    height: height,
                    sequence: sequence,
                    presentationTimeUs: presentationTimeUs
                )
            }
            if chunked.chunkCount > 1 {
                schemeHandler.updateChunkedNV12(chunked, jpegMirror: mirrorFrame)
            } else {
                schemeHandler.updateFrame(
                    SpoofFrame(
                        data: data,
                        format: format,
                        width: width,
                        height: height,
                        sequence: sequence,
                        presentationTimeUs: presentationTimeUs
                    )
                )
            }
        } else {
            schemeHandler.updateFrame(
                SpoofFrame(
                    data: data,
                    format: format,
                    width: width,
                    height: height,
                    sequence: sequence,
                    presentationTimeUs: presentationTimeUs
                )
            )
            pushJPEGFrameToJS(
                data: data,
                width: width,
                height: height,
                sequence: sequence,
                presentationTimeUs: presentationTimeUs
            )
        }
        updateMetrics(latency: latency)
        notifyStartFramePollIfNeeded()
    }

    private func pushJPEGFrameToJS(
        data: Data,
        width: Int,
        height: Int,
        sequence: UInt64,
        presentationTimeUs: UInt64
    ) {
        let payload: [String: Any] = [
            "b64": data.base64EncodedString(),
            "seq": sequence,
            "w": width,
            "h": height,
            "pts": presentationTimeUs
        ]
        let script = "if (window.__spoofOnJPEGPush) window.__spoofOnJPEGPush(p);"
        if let deliveryWebView {
            invokeJavaScript(
                script,
                arguments: ["p": payload],
                on: deliveryWebView,
                frame: deliveryFrame,
                label: "push"
            )
            return
        }
        for target in allAttachedWebViews {
            invokeJavaScript(
                script,
                arguments: ["p": payload],
                on: target,
                frame: nil,
                label: "push"
            )
        }
    }

    private func notifyStartFramePollIfNeeded() {
        guard !hasStartedPoll else { return }
        hasStartedPoll = true
        let script = "window.__spoofStartFramePoll && window.__spoofStartFramePoll();"
        if let deliveryWebView {
            runScript(script, on: deliveryWebView, frame: deliveryFrame, label: "poll")
            return
        }
        for target in allAttachedWebViews {
            runScript(script, on: target, frame: nil, label: "poll")
        }
    }

    private func runScript(
        _ script: String,
        on webView: WKWebView,
        frame: WKFrameInfo?,
        label: String
    ) {
        DispatchQueue.main.async {
            webView.evaluateJavaScript(script, in: frame, in: .page) { @MainActor result in
                guard case .failure(let error) = result else { return }
                DebugLogStore.shared.append(
                    level: "warn",
                    message: "[native] \(label) fail host=\(Self.host(for: frame)): \(error.localizedDescription)"
                )
            }
        }
    }

    private func invokeJavaScript(
        _ script: String,
        arguments: [String: Any],
        on webView: WKWebView,
        frame: WKFrameInfo?,
        label: String
    ) {
        DispatchQueue.main.async {
            webView.callAsyncJavaScript(
                script,
                arguments: arguments,
                in: frame,
                in: .page,
                completionHandler: { @MainActor result in
                    guard case .failure(let error) = result else { return }
                    DebugLogStore.shared.append(
                        level: "warn",
                        message: "[native] \(label) fail host=\(Self.host(for: frame)): \(error.localizedDescription)"
                    )
                }
            )
        }
    }

    private func notifyStopFramePoll() {
        hasStartedPoll = false
        let script = "window.__spoofStopFramePoll && window.__spoofStopFramePoll();"
        if let deliveryWebView {
            runScript(script, on: deliveryWebView, frame: deliveryFrame, label: "poll-stop")
            return
        }
        for target in allAttachedWebViews {
            runScript(script, on: target, frame: nil, label: "poll-stop")
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

    private static func parseStreamConfig(from body: [String: Any]) -> StreamDeliveryConfig? {
        guard let width = body["width"] as? Int,
              let height = body["height"] as? Int else { return nil }
        let frameRate = (body["frameRate"] as? Double) ?? (body["frameRate"] as? Int).map(Double.init) ?? 30
        return StreamDeliveryConfig(width: width, height: height, frameRate: frameRate)
    }
}