import AVFoundation

/// Keeps the system camera privacy indicator active while network ingest feeds spoofed frames.
final class CameraIndicatorSession {
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.safarispoof.camera.indicator")
    private var isActive = false

    func start(position: AVCaptureDevice.Position = .front) {
        queue.async { [weak self] in
            guard let self, !self.isActive else { return }
            self.configure(position: position)
            guard !self.session.inputs.isEmpty else { return }
            if !self.session.isRunning {
                self.session.startRunning()
            }
            self.isActive = true
        }
    }

    func stop() {
        queue.async { [weak self] in
            guard let self else { return }
            if self.session.isRunning {
                self.session.stopRunning()
            }
            self.session.inputs.forEach { self.session.removeInput($0) }
            self.session.outputs.forEach { self.session.removeOutput($0) }
            self.isActive = false
        }
    }

    private func configure(position: AVCaptureDevice.Position) {
        session.beginConfiguration()
        if session.canSetSessionPreset(.low) {
            session.sessionPreset = .low
        }

        session.inputs.forEach { session.removeInput($0) }
        session.outputs.forEach { session.removeOutput($0) }

        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized,
              let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            session.commitConfiguration()
            return
        }

        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        if session.canAddOutput(output) {
            session.addOutput(output)
        }

        session.commitConfiguration()
    }
}