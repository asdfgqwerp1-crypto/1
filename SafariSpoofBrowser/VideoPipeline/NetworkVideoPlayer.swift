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
    private var pendingURLs: [URL] = []
    private var currentURLIndex = 0
    private var isLiveHLS = false

    func play(url: String) {
        play(urls: StreamURLResolver.playbackCandidates(for: url))
    }

    func play(urls: [URL]) {
        stop()
        pendingURLs = urls
        currentURLIndex = 0
        guard !pendingURLs.isEmpty else { return }
        startCurrentURL()
    }

    func playFile(path: String) {
        play(url: URL(fileURLWithPath: path).absoluteString)
    }

    func attachPreview(to view: UIView) {
        playerLayer?.removeFromSuperlayer()
        guard let player else { return }
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.insertSublayer(layer, at: 0)
        playerLayer = layer
    }

    func updatePreviewLayout(in view: UIView) {
        guard view.bounds.width > 1, view.bounds.height > 1 else { return }
        playerLayer?.frame = view.bounds
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
        pendingURLs = []
        currentURLIndex = 0
        isLiveHLS = false
    }

    private func startCurrentURL() {
        guard currentURLIndex < pendingURLs.count else { return }
        let url = pendingURLs[currentURLIndex]
        isLiveHLS = url.path.hasSuffix(".m3u8") || url.absoluteString.contains(".m3u8")

        player?.pause()
        videoOutput = nil

        let asset = AVURLAsset(url: url)
        let item = AVPlayerItem(asset: asset)
        item.preferredForwardBufferDuration = isLiveHLS ? 1.0 : 0
        if #available(iOS 15.0, *) {
            item.preferredPeakBitRate = 0
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

    private func tryNextURL() {
        currentURLIndex += 1
        guard currentURLIndex < pendingURLs.count else { return }
        startCurrentURL()
    }

    private func setupOutput(for item: AVPlayerItem) {
        let settings: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        let output = AVPlayerItemVideoOutput(pixelBufferAttributes: settings)
        item.add(output)
        videoOutput = output
    }

    private func observeItem(_ item: AVPlayerItem, player: AVPlayer) {
        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            guard let self else { return }
            switch item.status {
            case .readyToPlay:
                self.seekToLiveEdge(item: item, player: player)
            case .failed:
                self.tryNextURL()
            default:
                break
            }
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
        displayLink?.invalidate()
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkFired))
        displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 30, preferred: 30)
        displayLink?.add(to: .main, forMode: .common)
    }

    private func startLiveEdgeSync(for item: AVPlayerItem, player: AVPlayer) {
        seekToLiveEdge(item: item, player: player)
        liveEdgeTimer?.invalidate()
        let timer = Timer(timeInterval: 0.75, repeats: true) { [weak self, weak item, weak player] _ in
            self?.seekToLiveEdge(item: item, player: player)
        }
        RunLoop.main.add(timer, forMode: .common)
        liveEdgeTimer = timer
    }

    private func seekToLiveEdge(item: AVPlayerItem?, player: AVPlayer?) {
        guard isLiveHLS, let item, let player, item.status == .readyToPlay else { return }
        guard let range = item.seekableTimeRanges.last?.timeRangeValue else { return }
        let live = CMTimeRangeGetEnd(range)
        let lag = CMTimeGetSeconds(CMTimeSubtract(live, item.currentTime()))
        guard lag.isFinite, lag > 0.75 else { return }
        player.seek(to: live, toleranceBefore: .zero, toleranceAfter: .zero)
    }

    @objc private func displayLinkFired() {
        guard let output = videoOutput,
              let player,
              let item = player.currentItem,
              item.status == .readyToPlay else { return }

        let time = item.currentTime()
        guard output.hasNewPixelBuffer(forItemTime: time),
              let buffer = output.copyPixelBuffer(forItemTime: time, itemTimeForDisplay: nil) else { return }

        onFrame?(buffer, videoTransform, CFAbsoluteTimeGetCurrent())
    }
}