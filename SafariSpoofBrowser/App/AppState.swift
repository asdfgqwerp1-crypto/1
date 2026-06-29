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

    private var cancellables = Set<AnyCancellable>()
    var effectiveProfile: DeviceProfile {
        activeProfile.withFrameDelivery(.jpeg)
    }

    init() {
        self.testServerHost = TestServerSettings.host
        let store = ProfileStore()
        self.profileStore = store
        self.activeProfile = store.defaultProfile
        UserDefaults.standard.set(FrameDeliveryFormat.jpeg.rawValue, forKey: "com.safarispoof.frameDelivery")
        self.frameBridge = FrameBridge()
        self.videoPipeline = VideoPipeline(frameBridge: frameBridge)
        self.frameBridge.delegate = self

        frameBridge.metricsPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] metrics in
                self?.bridgeMetrics = metrics
            }
            .store(in: &cancellables)
    }

    func selectProfile(_ profile: DeviceProfile) {
        activeProfile = profile
        videoPipeline.updateProfile(effectiveProfile)
    }

    func startVideoPipeline() {
        videoPipeline.start(source: videoSource, profile: effectiveProfile)
    }

    func stopVideoPipeline() {
        frameBridge.setDeliveryEnabled(false)
        videoPipeline.stop()
    }

    func prepareCameraAccess() {
        Task {
            await Self.requestCameraAccessIfNeeded()
        }
    }

    func frameBridgeDidRequestStreamStart(config: StreamDeliveryConfig?) {
        Task {
            let granted = await Self.requestCameraAccessIfNeeded()
            if granted {
                if let config {
                    videoPipeline.updateStreamDelivery(config)
                }
                startVideoPipeline()
            }
        }
    }

    func frameBridgeDidRequestStreamStop() {
        stopVideoPipeline()
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