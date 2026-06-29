import AVFoundation
import UIKit

final class NetworkVideoPlayer: NSObject {
    var onFrame: ((CVPixelBuffer, CGAffineTransform, CFAbsoluteTime) -> Void)?

    private(set) var player: AVPlayer?
    private var displayLink: CADisplayLink?
    private var videoOutput: AVPlayerItemVideoOutput?
    private var playerLayer: AVPlayerLayer?
    private var liveEdgeTimer: Timer?
    private var statusObserver: NSKeyValueObservation?
    private var videoTransform: CGAffineTransform = .identity

    func play(url: URL) {
        stop()
        let asset = AVURLAsset(url: url)
        let item = AVPlayerItem(asset: asset)
        item.preferredForwardBufferDuration = 0
        if #available(iOS 15.0, *) {
            item.preferredPeakBitRate = 0
        }
        if #available(iOS 14.0, *) {
            item.startsOnFirstEligibleVariant = true
        }
        setupOutput(for: item)
        let avPlayer = AVPlayer(playerItem: item)
        avPlayer.automaticallyWaitsToMinimizeStalling = false
        avPlayer.actionAtItemEnd = .none
        player = avPlayer
        observeItem(item, player: avPlayer)
        loadVideoTransform(from: asset)
        avPlayer.playImmediately(atRate: 1.0)
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
        statusObserver?.invalidate()
        statusObserver = nil
        liveEdgeTimer?.invalidate()
        liveEdgeTimer = nil
        displayLink?.invalidate()
        displayLink = nil
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        player?.pause()
        player = nil
        videoOutput = nil
        videoTransform = .identity
    }

    private func setupOutput(for item: AVPlayerItem) {
        let settings: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        let output = AVPlayerItemVideoOutput(pixelBufferAttributes: settings)
        output.suppressesPlayerRendering = true
        item.add(output)
        videoOutput = output
    }

    private func observeItem(_ item: AVPlayerItem, player: AVPlayer) {
        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            guard item.status == .readyToPlay else { return }
            self?.seekToLiveEdge(item: item, player: player)
        }
    }

    private func loadVideoTransform(from asset: AVURLAsset) {
        Task {
            guard let track = try? await asset.loadTracks(withMediaType: .video).first else { return }
            let transform = (try? await track.load(.preferredTransform)) ?? .identity
            await MainActor.run { [weak self] in
                self?.videoTransform = transform
            }
        }
    }

    private func startDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkFired))
        displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 30, preferred: 30)
        displayLink?.add(to: .main, forMode: .common)
    }

    private func startLiveEdgeSync(for item: AVPlayerItem, player: AVPlayer) {
        seekToLiveEdge(item: item, player: player)
        let timer = Timer(timeInterval: 0.75, repeats: true) { [weak self, weak item, weak player] _ in
            self?.seekToLiveEdge(item: item, player: player)
        }
        RunLoop.main.add(timer, forMode: .common)
        liveEdgeTimer = timer
    }

    private func seekToLiveEdge(item: AVPlayerItem?, player: AVPlayer?) {
        guard let item, let player, item.status == .readyToPlay else { return }
        guard let range = item.seekableTimeRanges.last?.timeRangeValue else { return }
        let live = CMTimeRangeGetEnd(range)
        let lag = CMTimeGetSeconds(CMTimeSubtract(live, item.currentTime()))
        guard lag.isFinite, lag > 0.75 else { return }
        player.seek(to: live, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    @objc private func displayLinkFired() {
        guard let output = videoOutput,
              let player,
              let item = player.currentItem else { return }

        let time = item.currentTime()
        guard output.hasNewPixelBuffer(forItemTime: time),
              let buffer = output.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: nil) else { return }

        onFrame?(buffer, videoTransform, CFAbsoluteTimeGetCurrent())
    }
}