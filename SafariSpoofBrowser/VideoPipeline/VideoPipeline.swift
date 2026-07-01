import AVFoundation
import UIKit

final class VideoPipeline: NSObject {
    private let frameBridge: FrameBridge
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.safarispoof.video.session")
    private let processingQueue = DispatchQueue(label: "com.safarispoof.video.processing")
    private var videoOutput: AVCaptureVideoDataOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private weak var previewContainer: UIView?
    private var networkPlayer: NetworkVideoPlayer?
    private var httpSnapshotPlayer: HttpSnapshotPlayer?
    private var cameraIndicator: CameraIndicatorSession?
    private var cameraIndicatorEnabled = false
    private var activeProfile: DeviceProfile?
    private var isRunning = false
    private var lastFrameTime: CFAbsoluteTime = 0
    private var configureAttempts = 0
    private var frameSequence: UInt64 = 0
    private var frameTiming = FrameTiming.iphoneDefault
    private var streamDelivery: StreamDeliveryConfig?
    private var lastDeliverBlockLog: CFAbsoluteTime = 0
    private var loggedFirstDeliver = false

    /// True when HTTP snapshot or network player is actively polling (preview or browser).
    var isNetworkStreamActive: Bool {
        isRunning && (httpSnapshotPlayer != nil || networkPlayer != nil)
    }

    init(frameBridge: FrameBridge) {
        self.frameBridge = frameBridge
        super.init()
    }

    func updateProfile(_ profile: DeviceProfile) {
        activeProfile = profile
        frameTiming = profile.resolvedFrameTiming
    }

    func updateStreamDelivery(_ config: StreamDeliveryConfig) {
        streamDelivery = config
        loggedFirstDeliver = false
        if let profile = activeProfile {
            activeProfile = profile.withStreamDelivery(config)
        }
    }

    func setCameraIndicatorActive(_ active: Bool) {
        cameraIndicatorEnabled = active
        if active, isRunning, httpSnapshotPlayer != nil || networkPlayer != nil {
            startCameraIndicatorIfNeeded()
        } else {
            stopCameraIndicator()
        }
    }

    func start(source: VideoSourceType, profile: DeviceProfile) {
        let preservedDelivery = streamDelivery
        stop()
        streamDelivery = preservedDelivery
        activeProfile = profile
        isRunning = true
        lastFrameTime = 0
        frameSequence = 0
        configureAttempts = 0

        switch source {
        case .deviceCamera(let position):
            startCamera(position: position)
        case .networkStream(let url):
            startNetworkStream(url: url, profile: profile)
        case .network:
            if let saved = NetworkStreamSettings.url, !saved.isEmpty {
                startNetworkStream(url: saved, profile: profile)
            }
        case .file(let path):
            startFilePlayback(path: path, profile: profile)
        }
    }

    func stop() {
        isRunning = false
        lastFrameTime = 0
        frameSequence = 0
        loggedFirstDeliver = false
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
            self.session.inputs.forEach { self.session.removeInput($0) }
            self.session.outputs.forEach { self.session.removeOutput($0) }
        }
        networkPlayer?.stop()
        networkPlayer = nil
        httpSnapshotPlayer?.stop()
        httpSnapshotPlayer = nil
        cameraIndicatorEnabled = false
        stopCameraIndicator()
        videoOutput = nil
    }

    private func startCameraIndicatorIfNeeded() {
        guard cameraIndicatorEnabled else { return }
        if cameraIndicator == nil {
            cameraIndicator = CameraIndicatorSession()
        }
        cameraIndicator?.start(position: .front)
    }

    private func stopCameraIndicator() {
        cameraIndicator?.stop()
        cameraIndicator = nil
    }

    func attachPreview(to view: UIView) {
        previewContainer = view
        reinstallPreview(on: view)
        updatePreviewLayout(in: view)
    }

    func updatePreviewLayout(in view: UIView) {
        let bounds = view.bounds
        guard bounds.width > 1, bounds.height > 1 else { return }
        previewLayer?.frame = bounds
        httpSnapshotPlayer?.updatePreviewLayout(in: view)
        networkPlayer?.updatePreviewLayout(in: view)
    }

    private func reinstallPreview(on view: UIView) {
        previewLayer?.removeFromSuperlayer()
        previewLayer = nil
        if let httpSnapshotPlayer {
            httpSnapshotPlayer.attachPreview(to: view)
            return
        }
        if let networkPlayer {
            networkPlayer.attachPreview(to: view)
            return
        }
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.insertSublayer(layer, at: 0)
        previewLayer = layer
    }

    // MARK: - Camera

    private func startCamera(position: AVCaptureDevice.Position) {
        sessionQueue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.configureSession(position: position)
        }
    }

    private func scheduleConfigureRetry(position: AVCaptureDevice.Position) {
        guard isRunning, configureAttempts < 6 else { return }
        configureAttempts += 1
        let delay = Double(configureAttempts) * 0.4
        sessionQueue.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.isRunning else { return }
            self.configureSession(position: position)
        }
    }

    private func configureSession(position: AVCaptureDevice.Position) {
        session.beginConfiguration()
        if session.canSetSessionPreset(.vga640x480) {
            session.sessionPreset = .vga640x480
        } else {
            session.sessionPreset = .medium
        }

        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }

        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
            session.commitConfiguration()
            scheduleConfigureRetry(position: position)
            return
        }

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device) else {
            session.commitConfiguration()
            scheduleConfigureRetry(position: position)
            return
        }

        if session.canAddInput(input) { session.addInput(input) }

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: processingQueue)

        if session.canAddOutput(output) {
            session.addOutput(output)
            videoOutput = output
        }

        if let connection = output.connection(with: .video) {
            if #available(iOS 17.0, *) {
                if connection.isVideoRotationAngleSupported(90) {
                    connection.videoRotationAngle = 90
                }
            } else if connection.isVideoOrientationSupported {
                connection.videoOrientation = .portrait
            }
        }

        session.commitConfiguration()
        if !session.isRunning { session.startRunning() }
        DispatchQueue.main.async { [weak self] in
            guard let self, let view = self.previewContainer else { return }
            self.updatePreviewLayout(in: view)
        }
    }

    // MARK: - Network / file

    private func startNetworkStream(url: String, profile: DeviceProfile) {
        if let frameURL = StreamURLResolver.httpFrameURL(from: url) {
            startHttpSnapshotStream(url: frameURL, profile: profile)
            return
        }

        let candidates = StreamURLResolver.playbackCandidates(for: url)
        guard !candidates.isEmpty else { return }
        let player = NetworkVideoPlayer()
        player.onFrame = { [weak self] pixelBuffer, transform, timestamp in
            self?.processPixelBufferIfNeeded(
                pixelBuffer,
                transform: transform,
                presentationTimeUs: UInt64(max(0, timestamp) * 1_000_000),
                profile: profile
            )
        }
        networkPlayer = player
        player.play(url: url)
    }

    private func startHttpSnapshotStream(url: URL, profile: DeviceProfile) {
        let player = HttpSnapshotPlayer()
        player.onJPEG = { [weak self] data in
            self?.sendHTTPJPEG(data, profile: profile)
        }
        httpSnapshotPlayer = player
        player.play(url: url)
    }

    private func sendHTTPJPEG(_ data: Data, profile: DeviceProfile) {
        guard isRunning else { return }
        if Thread.isMainThread {
            deliverHTTPJPEG(data, profile: profile)
        } else {
            DispatchQueue.main.async { [weak self] in
                self?.deliverHTTPJPEG(data, profile: profile)
            }
        }
    }

    private func deliverHTTPJPEG(_ data: Data, profile: DeviceProfile) {
        guard isRunning else { return }
        guard frameBridge.isDelivering else {
            let now = CFAbsoluteTimeGetCurrent()
            if now - lastDeliverBlockLog > 3 {
                lastDeliverBlockLog = now
                DispatchQueue.main.async {
                    DebugLogStore.shared.append(
                        level: "warn",
                        message: "[native] deliver blocked isDelivering=false bytes=\(data.count)"
                    )
                }
            }
            return
        }

        let now = CFAbsoluteTimeGetCurrent()
        let interval = frameTiming.nextIntervalSeconds(frameIndex: frameSequence)
        guard now - lastFrameTime >= interval else { return }
        lastFrameTime = now

        let targetWidth = streamDelivery?.width ?? profile.mediaCapabilities.width
        let targetHeight = streamDelivery?.height ?? profile.mediaCapabilities.height
        frameSequence &+= 1

        let payload = scaledJPEGData(
            from: data,
            width: targetWidth,
            height: targetHeight,
            quality: 0.82
        ) ?? data

        frameBridge.sendFrame(
            data: payload,
            format: .jpeg,
            width: targetWidth,
            height: targetHeight,
            sequence: frameSequence,
            presentationTimeUs: UInt64(now * 1_000_000),
            captureTimestamp: now
        )
        if !loggedFirstDeliver {
            loggedFirstDeliver = true
            DispatchQueue.main.async {
                DebugLogStore.shared.append(
                    level: "info",
                    message: "[native] first JPEG deliver \(targetWidth)x\(targetHeight) bytes=\(payload.count)"
                )
            }
        }
    }

    private func scaledJPEGData(from data: Data, width: Int, height: Int, quality: CGFloat) -> Data? {
        guard width > 0, height > 0, let image = UIImage(data: data) else { return nil }
        let srcSize = image.size
        guard srcSize.width > 1, srcSize.height > 1 else { return nil }

        if Int(srcSize.width.rounded()) == width && Int(srcSize.height.rounded()) == height {
            return data
        }

        let targetSize = CGSize(width: width, height: height)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let scaled = renderer.image { ctx in
            UIColor.black.setFill()
            ctx.fill(CGRect(origin: .zero, size: targetSize))
            let scale = max(targetSize.width / srcSize.width, targetSize.height / srcSize.height)
            let drawW = srcSize.width * scale
            let drawH = srcSize.height * scale
            let origin = CGPoint(
                x: (targetSize.width - drawW) * 0.5,
                y: (targetSize.height - drawH) * 0.5
            )
            image.draw(in: CGRect(origin: origin, size: CGSize(width: drawW, height: drawH)))
        }
        return scaled.jpegData(compressionQuality: quality)
    }

    private func startFilePlayback(path: String, profile: DeviceProfile) {
        let player = NetworkVideoPlayer()
        player.onFrame = { [weak self] pixelBuffer, transform, timestamp in
            self?.processPixelBufferIfNeeded(
                pixelBuffer,
                transform: transform,
                presentationTimeUs: UInt64(max(0, timestamp) * 1_000_000),
                profile: profile
            )
        }
        networkPlayer = player
        player.playFile(path: path)
    }

    private func processSampleBufferIfNeeded(_ sampleBuffer: CMSampleBuffer, profile: DeviceProfile) {
        guard isRunning,
              frameBridge.isDelivering,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let now = CFAbsoluteTimeGetCurrent()
        let interval = frameTiming.nextIntervalSeconds(frameIndex: frameSequence)
        guard now - lastFrameTime >= interval else { return }
        lastFrameTime = now

        let ptsUs = NV12FramePacker.presentationTimeUs(from: sampleBuffer)
        sendPixelBuffer(pixelBuffer, profile: profile, captureTimestamp: now, presentationTimeUs: ptsUs)
    }

    private func processPixelBufferIfNeeded(
        _ pixelBuffer: CVPixelBuffer,
        transform: CGAffineTransform = .identity,
        presentationTimeUs: UInt64,
        profile: DeviceProfile
    ) {
        guard isRunning, frameBridge.isDelivering else { return }

        let now = CFAbsoluteTimeGetCurrent()
        let interval = frameTiming.nextIntervalSeconds(frameIndex: frameSequence)
        guard now - lastFrameTime >= interval else { return }
        lastFrameTime = now

        sendPixelBuffer(
            pixelBuffer,
            transform: transform,
            profile: profile,
            captureTimestamp: now,
            presentationTimeUs: presentationTimeUs
        )
    }

    private func sendPixelBuffer(
        _ pixelBuffer: CVPixelBuffer,
        transform: CGAffineTransform = .identity,
        profile: DeviceProfile,
        captureTimestamp: CFAbsoluteTime,
        presentationTimeUs: UInt64
    ) {
        let targetWidth = streamDelivery?.width ?? profile.mediaCapabilities.width
        let targetHeight = streamDelivery?.height ?? profile.mediaCapabilities.height
        let useNV12 = profile.resolvedFrameDelivery == .nv12

        frameSequence &+= 1

        if useNV12,
           let nv12Buffer = NV12FramePacker.scaledNV12Buffer(
               from: pixelBuffer,
               width: targetWidth,
               height: targetHeight,
               transform: transform
           ),
           let packed = NV12FramePacker.pack(nv12Buffer) {
            let jpegMirror = jpegData(from: pixelBuffer, width: targetWidth, height: targetHeight, transform: transform)
            frameBridge.sendFrame(
                data: packed,
                format: .nv12,
                width: targetWidth,
                height: targetHeight,
                sequence: frameSequence,
                presentationTimeUs: presentationTimeUs,
                captureTimestamp: captureTimestamp,
                jpegMirror: jpegMirror
            )
            return
        }

        guard let jpeg = jpegData(from: pixelBuffer, width: targetWidth, height: targetHeight, transform: transform) else { return }
        frameBridge.sendFrame(
            data: jpeg,
            format: .jpeg,
            width: targetWidth,
            height: targetHeight,
            sequence: frameSequence,
            presentationTimeUs: presentationTimeUs,
            captureTimestamp: captureTimestamp
        )
    }

    private func jpegData(
        from pixelBuffer: CVPixelBuffer,
        width: Int,
        height: Int,
        transform: CGAffineTransform = .identity
    ) -> Data? {
        let attrs: [String: Any] = [
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]
        var outputBuffer: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_32BGRA,
            attrs as CFDictionary,
            &outputBuffer
        )
        guard status == kCVReturnSuccess, let output = outputBuffer else { return nil }

        FrameScaler.renderAspectFill(from: pixelBuffer, to: output, transform: transform)

        CVPixelBufferLockBaseAddress(output, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(output, .readOnly) }

        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(output),
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(output),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ), let cgImage = context.makeImage() else { return nil }

        return UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.28)
    }
}

extension VideoPipeline: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let profile = activeProfile else { return }
        processSampleBufferIfNeeded(sampleBuffer, profile: profile)
    }
}