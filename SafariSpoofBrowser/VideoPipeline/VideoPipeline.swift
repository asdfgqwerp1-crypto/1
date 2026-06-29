import AVFoundation
import UIKit
import CoreImage

final class VideoPipeline: NSObject {
    private let frameBridge: FrameBridge
    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.safarispoof.video.session")
    private let processingQueue = DispatchQueue(label: "com.safarispoof.video.processing")
    private var photoOutput: AVCapturePhotoOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var networkPlayer: NetworkVideoPlayer?
    private var activeProfile: DeviceProfile?
    private var isRunning = false
    private var captureTimer: DispatchSourceTimer?
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
        stopCaptureTimer()
        sessionQueue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning { self.session.stopRunning() }
            self.session.inputs.forEach { self.session.removeInput($0) }
            self.session.outputs.forEach { self.session.removeOutput($0) }
        }
        networkPlayer?.stop()
        networkPlayer = nil
        photoOutput = nil
    }

    func attachPreview(to view: UIView) {
        previewLayer?.removeFromSuperlayer()
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        previewLayer = layer
    }

    // MARK: - Camera (photo timer, max 8 fps)

    private func startCamera(position: AVCaptureDevice.Position) {
        sessionQueue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.configureSession(position: position)
            self.startCaptureTimer()
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

        let output = AVCapturePhotoOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            photoOutput = output
        }

        session.commitConfiguration()
        if !session.isRunning { session.startRunning() }
    }

    private func startCaptureTimer() {
        stopCaptureTimer()
        let timer = DispatchSource.makeTimerSource(queue: processingQueue)
        timer.schedule(deadline: .now() + 0.2, repeating: 1.0 / 8.0)
        timer.setEventHandler { [weak self] in
            self?.capturePhotoIfNeeded()
        }
        timer.resume()
        captureTimer = timer
    }

    private func stopCaptureTimer() {
        captureTimer?.cancel()
        captureTimer = nil
    }

    private func capturePhotoIfNeeded() {
        guard isRunning, frameBridge.isDelivering, let photoOutput else { return }
        let settings = AVCapturePhotoSettings()
        if photoOutput.availablePhotoCodecTypes.contains(.jpeg) {
            photoOutput.capturePhoto(with: settings, delegate: self)
        }
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

    private var lastNetworkProcessTime: CFAbsoluteTime = 0

    private func processPixelBufferIfNeeded(_ pixelBuffer: CVPixelBuffer, captureTimestamp: CFAbsoluteTime, profile: DeviceProfile) {
        guard isRunning, frameBridge.isDelivering else { return }
        let now = CFAbsoluteTimeGetCurrent()
        guard now - lastNetworkProcessTime >= 1.0 / 8.0 else { return }
        lastNetworkProcessTime = now
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

        return UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.3)
    }
}

extension VideoPipeline: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard isRunning, frameBridge.isDelivering, error == nil,
              let profile = activeProfile,
              let data = photo.fileDataRepresentation() else { return }

        frameBridge.sendFrame(
            jpegData: data,
            width: profile.mediaCapabilities.width,
            height: profile.mediaCapabilities.height,
            timestamp: CFAbsoluteTimeGetCurrent()
        )
    }
}