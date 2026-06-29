import Foundation
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var activeProfile: DeviceProfile
    @Published var videoSource: VideoSourceType = .deviceCamera(position: .front)
    @Published var bridgeMetrics = FrameBridgeMetrics()
    @Published var showSettings = false

    let profileStore: ProfileStore
    let videoPipeline: VideoPipeline
    let frameBridge: FrameBridge

    init() {
        let store = ProfileStore()
        self.profileStore = store
        self.activeProfile = store.defaultProfile
        self.frameBridge = FrameBridge()
        self.videoPipeline = VideoPipeline(frameBridge: frameBridge)
    }

    func selectProfile(_ profile: DeviceProfile) {
        activeProfile = profile
        videoPipeline.updateProfile(profile)
    }

    func startVideoPipeline() {
        videoPipeline.start(source: videoSource, profile: activeProfile)
    }

    func stopVideoPipeline() {
        videoPipeline.stop()
    }
}