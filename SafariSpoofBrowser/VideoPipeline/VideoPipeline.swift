import AVFoundation
import UIKit
import CoreImage

final class VideoPipeline: NSObject {
    private let frameBridge: FrameBridge
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.safarispoof.video.session")
    private let processingQueue = DispatchQueue(label: "com.safarispoof.video.processing")
    private var videoOutput: AVCaptureVideoDataOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var networkPlayer: NetworkVideoPlayer?
    private var activeProfile: DeviceProfile?
    private var isRunning = false
    private var lastFrameTime: CFAbsoluteTime = 0
    private let minFrameInterval: CFAbsoluteTime = 1.0 / 10.0
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    init(frameBridge: FrameBridge) {
        self.frameBridge = frameBridge
        super.init()
    }

    func updateProfile(_ profile: DeviceProfile) {
        activeProfile = profile
    }

    func start(source: VideoSourceType, profile: DeviceProfile) {
        stop()
        activeProfile = profile
        isRunning = true
        lastFrameTime = 0

        switch source {
        case .deviceCamera(let position):
            startCamera(position: position)
        case .networkStream(let url):
            startNetworkStream(url: url, profile: profile)
        case .network:
            break
        case .file(let path):
            startFilePlayback(path: path, profile: profile)
        }
    }

    func stop() {
        isRunning = false
        lastFrameTime = 0
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
            self.session.inputs.forEach { self.session.removeInput($0) }
            self.session.outputs.forEach { self.session.removeOutput($0) }
        }
        networkPlayer?.stop()
        networkPlayer = nil
        videoOutput = nil
    }

    func attachPreview(to view: UIView) {
        previewLayer?.removeFromSuperlayer()
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        previewLayer = layer
    }

    // MARK: - Camera

    private func startCamera(position: AVCaptureDevice.Position) {
        let mediaType = AVMediaType.video
        switch AVCaptureDevice.authorizationStatus(for: mediaType) {
        case .authorized:
            sessionQueue.async { [weak self] in
                guard let self, self.isRunning else { return }
                self.configureSession(position: position)
            }
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: mediaType) { [weak self] granted in
                guard let self, self.isRunning, granted else { return }
                self.sessionQueue.async {
                    guard self.isRunning else { return }
                    self.configureSession(position: position)
                }
            }
        default:
            break
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

        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device) else {
            session.commitConfiguration()
            return
        }

        if session.canAddInput(input) { session.addInput(input) }

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
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
    }

    // MARK: - Network / file

    private func startNetworkStream(url: String, profile: DeviceProfile) {
        guard let streamURL = URL(string: url) else { return }
        let player = NetworkVideoPlayer()
        player.onFrame = { [weak self] pixelBuffer, timestamp in
            self?.processPixelBufferIfNeeded(pixelBuffer, captureTimestamp: timestamp, profile: profile)
        }
        networkPlayer = player
        player.play(url: streamURL)
    }

    private func startFilePlayback(path: String, profile: DeviceProfile) {
        let player = NetworkVideoPlayer()
        player.onFrame = { [weak self] pixelBuffer, timestamp in
            self?.processPixelBufferIfNeeded(pixelBuffer, captureTimestamp: timestamp, profile: profile)
        }
        networkPlayer = player
        player.playFile(path: path)
    }

    private func processPixelBufferIfNeeded(_ pixelBuffer: CVPixelBuffer, captureTimestamp: CFAbsoluteTime, profile: DeviceProfile) {
        guard isRunning, frameBridge.isDelivering else { return }

        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastFrameTime >= minFrameInterval else { return }
        lastFrameTime = now

        sendPixelBuffer(pixelBuffer, profile: profile, timestamp: captureTimestamp)
    }

    private func sendPixelBuffer(_ pixelBuffer: CVPixelBuffer, profile: DeviceProfile, timestamp: CFAbsoluteTime) {
        let targetWidth = profile.mediaCapabilities.width
        let targetHeight = profile.mediaCapabilities.height

        let attrs: [String: Any] = [
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]
        var outputBuffer: CVPixelBuffer?
        CVPixelBufferCreate(
            kCFAllocatorDefault,
            targetWidth,
            targetHeight,
            kCVPixelFormatType_32BGRA,
            attrs as CFDictionary,
            &outputBuffer
        )
        guard let output = outputBuffer else { return }

        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let scaleX = CGFloat(targetWidth) / ciImage.extent.width
        let scaleY = CGFloat(targetHeight) / ciImage.extent.height
        let scaled = ciImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
        ciContext.render(scaled, to: output)

        guard let jpeg = jpegData(from: output, width: targetWidth, height: targetHeight) else { return }
        frameBridge.sendFrame(jpegData: jpeg, width: targetWidth, height: targetHeight, timestamp: timestamp)
    }

    private func jpegData(from pixelBuffer: CVPixelBuffer, width: Int, height: Int) -> Data? {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

        guard let context = CGContext(
            data: CVPixelBufferGetBaseAddress(pixelBuffer),
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ), let cgImage = context.makeImage() else { return nil }

        return UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.35)
    }
}

extension VideoPipeline: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard isRunning,
              frameBridge.isDelivering,
              let profile = activeProfile,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let timestamp = CFAbsoluteTimeGetCurrent()
        processPixelBufferIfNeeded(pixelBuffer, captureTimestamp: timestamp, profile: profile)
    }
}