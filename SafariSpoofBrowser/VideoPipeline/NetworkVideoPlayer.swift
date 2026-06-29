import AVFoundation
import UIKit

final class NetworkVideoPlayer: NSObject {
    var onFrame: ((CVPixelBuffer, CFAbsoluteTime) -> Void)?

    private(set) var player: AVPlayer?
    private var displayLink: CADisplayLink?
    private var videoOutput: AVPlayerItemVideoOutput?
    private var playerLayer: AVPlayerLayer?
    private var liveEdgeTimer: Timer?

    func play(url: URL) {
        stop()
        let item = AVPlayerItem(url: url)
        item.preferredForwardBufferDuration = 0.5
        if #available(iOS 15.0, *) {
            item.preferredPeakBitRate = 0
        }
        setupOutput(for: item)
        let avPlayer = AVPlayer(playerItem: item)
        avPlayer.automaticallyWaitsToMinimizeStalling = false
        avPlayer.play()
        player = avPlayer
        startDisplayLink()
        startLiveEdgeSync(for: item, player: avPlayer)
    }

    func playFile(path: String) {
        play(url: URL(fileURLWithPath: path))
    }

    func attachPreview(to view: UIView) {
        playerLayer?.removeFromSuperlayer()
        guard let player else { return }
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        playerLayer = layer
    }

    func stop() {
        liveEdgeTimer?.invalidate()
        liveEdgeTimer = nil
        displayLink?.invalidate()
        displayLink = nil
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
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

    private func startLiveEdgeSync(for item: AVPlayerItem, player: AVPlayer) {
        liveEdgeTimer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self, weak item, weak player] _ in
            self?.seekToLiveEdge(item: item, player: player)
        }
    }

    private func seekToLiveEdge(item: AVPlayerItem?, player: AVPlayer?) {
        guard let item, let player, item.status == .readyToPlay else { return }
        guard let range = item.seekableTimeRanges.last?.timeRangeValue else { return }
        let live = CMTimeRangeGetEnd(range)
        let lag = CMTimeGetSeconds(CMTimeSubtract(live, item.currentTime()))
        guard lag.isFinite, lag > 2.5 else { return }
        player.seek(to: live, toleranceBefore: .zero, toleranceAfter: .zero)
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