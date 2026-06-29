import AVFoundation

enum VideoSourceType: Equatable, Hashable {
    case deviceCamera(position: AVCaptureDevice.Position)
    case networkStream(url: String)
    case network
    case file(path: String)
}