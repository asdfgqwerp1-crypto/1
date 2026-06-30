import Foundation
import Combine
import AVFoundation

@MainActor
final class AppState: ObservableObject, FrameBridgeDelegate {
    @Published var activeProfile: DeviceProfile
    @Published var videoSource: VideoSourceType = .deviceCamera(position: .front)
    @Published var bridgeMetrics = FrameBridgeMetrics()
    @Published var showSettings = false
    @Published var testServerHost: String

    let profileStore: ProfileStore
    let videoPipeline: VideoPipeline
    let frameBridge: FrameBridge
    let tabCoordinator: TabCoordinator

    private var cancellables = Set<AnyCancellable>()
    var effectiveProfile: DeviceProfile {
        activeProfile.withFrameDelivery(.jpeg)
    }

    init() {
        self.testServerHost = TestServerSettings.host
        let store = ProfileStore()
        self.profileStore = store
        if let savedProfileID = BrowserSessionSettings.activeProfileID,
           let savedProfile = store.profile(id: savedProfileID) {
            self.activeProfile = savedProfile
        } else if let snapshot = BrowserSessionStore.load(),
                  let snapshotProfile = store.profile(id: snapshot.activeProfileID) {
            self.activeProfile = snapshotProfile
        } else {
            self.activeProfile = store.defaultProfile
        }
        UserDefaults.standard.set(FrameDeliveryFormat.jpeg.rawValue, forKey: "com.safarispoof.frameDelivery")
        self.frameBridge = FrameBridge()
        self.videoPipeline = VideoPipeline(frameBridge: frameBridge)

        let initialProfile = activeProfile
        self.tabCoordinator = TabCoordinator(
            profileProvider: { initialProfile.withFrameDelivery(.jpeg) },
            profileIDProvider: { initialProfile.id }
        )

        self.frameBridge.delegate = self
        self.frameBridge.setSchemeAuthKey(activeProfile.schemeAuthKey)
        tabCoordinator.setProfileProviders(
            profileProvider: { [weak self] in self?.effectiveProfile ?? initialProfile },
            profileIDProvider: { [weak self] in self?.activeProfile.id ?? initialProfile.id }
        )

        if let savedURL = NetworkStreamSettings.url, !savedURL.isEmpty {
            self.videoSource = .networkStream(url: savedURL)
        }

        frameBridge.metricsPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] metrics in
                self?.bridgeMetrics = metrics
            }
            .store(in: &cancellables)

        tabCoordinator.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    func selectProfile(_ profile: DeviceProfile) {
        activeProfile = profile
        frameBridge.setSchemeAuthKey(profile.schemeAuthKey)
        videoPipeline.updateProfile(effectiveProfile)
        BrowserSessionSettings.activeProfileID = profile.id
        tabCoordinator.persistNow()
    }

    func startVideoPipeline() {
        switch videoSource {
        case .deviceCamera:
            Task { @MainActor in
                guard await Self.requestCameraAccessIfNeeded() else { return }
                startVideoPipelineNow()
            }
        default:
            startVideoPipelineNow()
        }
    }

    private func startVideoPipelineNow() {
        if isNetworkVideoSource {
            let profile = effectiveProfile
            videoPipeline.updateStreamDelivery(
                StreamDeliveryConfig(
                    width: profile.mediaCapabilities.width,
                    height: profile.mediaCapabilities.height,
                    frameRate: profile.mediaCapabilities.frameRate
                )
            )
        }
        videoPipeline.start(source: videoSource, profile: effectiveProfile)
    }

    var usesNetworkVideoSource: Bool { isNetworkVideoSource }

    private var isNetworkVideoSource: Bool {
        switch videoSource {
        case .networkStream, .network:
            return true
        default:
            return false
        }
    }

    func stopVideoPipeline() {
        frameBridge.setDeliveryEnabled(false)
        videoPipeline.setCameraIndicatorActive(false)
        videoPipeline.stop()
    }

    func prepareCameraAccess() {
        Task {
            await Self.requestCameraAccessIfNeeded()
        }
    }

    func frameBridgeDidRequestStreamStart(config: StreamDeliveryConfig?) {
        let dims = config.map { "\($0.width)x\($0.height)@\($0.frameRate)" } ?? "default"
        DebugLogStore.shared.append(
            level: "info",
            message: "[native] stream/start \(dims) network=\(isNetworkVideoSource)"
        )
        if let config {
            videoPipeline.updateStreamDelivery(config)
        }
        if isNetworkVideoSource {
            // FrameBridge already enabled delivery in handleControlMessage.
            // Do not restart the HTTP player — Settings preview may already be polling.
            ensureNetworkStreamRunning()
            Task {
                if await Self.requestCameraAccessIfNeeded() {
                    videoPipeline.setCameraIndicatorActive(true)
                }
            }
            return
        }
        Task {
            guard await Self.requestCameraAccessIfNeeded() else { return }
            startVideoPipelineNow()
        }
    }

    func prepareForBrowser() {
        guard isNetworkVideoSource else { return }
        videoPipeline.setCameraIndicatorActive(false)
        ensureNetworkStreamRunning()
        // Pre-warm spoofframe buffer so getUserMedia is not blocked on first poll.
        frameBridge.setDeliveryEnabled(true)
    }

    func frameBridgeDidRequestStreamStop() {
        videoPipeline.setCameraIndicatorActive(false)
        if isNetworkVideoSource {
            frameBridge.setDeliveryEnabled(false)
            return
        }
        stopVideoPipeline()
    }

    private func ensureNetworkStreamRunning() {
        guard isNetworkVideoSource else { return }
        if videoPipeline.isNetworkStreamActive { return }
        startVideoPipelineNow()
    }

    static func requestCameraPermission() async -> Bool {
        await requestCameraAccessIfNeeded()
    }

    private static func requestCameraAccessIfNeeded() async -> Bool {
        let mediaType = AVMediaType.video
        switch AVCaptureDevice.authorizationStatus(for: mediaType) {
        case .authorized:
            return true
        case .notDetermined:
            return await withCheckedContinuation { continuation in
                AVCaptureDevice.requestAccess(for: mediaType) { granted in
                    continuation.resume(returning: granted)
                }
            }
        default:
            return false
        }
    }
}