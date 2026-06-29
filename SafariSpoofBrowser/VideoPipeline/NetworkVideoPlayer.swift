import AVFoundation

final class NetworkVideoPlayer: NSObject {
    var onFrame: ((CVPixelBuffer, CFAbsoluteTime) -> Void)?

    private var player: AVPlayer?
    private var displayLink: CADisplayLink?
    private var videoOutput: AVPlayerItemVideoOutput?

    func play(url: URL) {
        stop()
        let item = AVPlayerItem(url: url)
        setupOutput(for: item)
        player = AVPlayer(playerItem: item)
        player?.play()
        startDisplayLink()
    }

    func playFile(path: String) {
        play(url: URL(fileURLWithPath: path))
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
        player?.pause()
        player = nil
        videoOutput = nil
    }

    private func setupOutput(for item: AVPlayerItem) {
        let settings: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        let output = AVPlayerItemVideoOutput(pixelBufferAttributes: settings)
        item.add(output)
        videoOutput = output
    }

    private func startDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkFired))
        displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 30, preferred: 30)
        displayLink?.add(to: .main, forMode: .common)
    }

    @objc private func displayLinkFired() {
        guard let output = videoOutput,
              let player,
              let item = player.currentItem else { return }

        let time = item.currentTime()
        guard output.hasNewPixelBuffer(forItemTime: time),
              let buffer = output.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: nil) else { return }

        onFrame?(buffer, CFAbsoluteTimeGetCurrent())
    }
}