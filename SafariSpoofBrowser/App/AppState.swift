import Foundation
import Combine

@MainActor
final class AppState: ObservableObject, FrameBridgeDelegate {
    @Published var activeProfile: DeviceProfile
    @Published var videoSource: VideoSourceType = .deviceCamera(position: .front)
    @Published var bridgeMetrics = FrameBridgeMetrics()
    @Published var showSettings = false

    let profileStore: ProfileStore
    let videoPipeline: VideoPipeline
    let frameBridge: FrameBridge

    private var isPipelineRunning = false

    init() {
        let store = ProfileStore()
        self.profileStore = store
        self.activeProfile = store.defaultProfile
        self.frameBridge = FrameBridge()
        self.videoPipeline = VideoPipeline(frameBridge: frameBridge)
        self.frameBridge.delegate = self
    }

    func selectProfile(_ profile: DeviceProfile) {
        activeProfile = profile
        videoPipeline.updateProfile(profile)
    }

    func startVideoPipeline() {
        guard !isPipelineRunning else { return }
        isPipelineRunning = true
        videoPipeline.start(source: videoSource, profile: activeProfile)
    }

    func stopVideoPipeline() {
        isPipelineRunning = false
        frameBridge.setDeliveryEnabled(false)
        videoPipeline.stop()
    }

    func frameBridgeDidRequestStreamStart() {
        startVideoPipeline()
    }

    func frameBridgeDidRequestStreamStop() {
        stopVideoPipeline()
    }
}