import Foundation

final class ProfileStore {
    let profiles: [DeviceProfile]
    let defaultProfile: DeviceProfile

    init(bundle: Bundle = .main) {
        profiles = Self.loadProfiles(from: bundle)
        defaultProfile = profiles.first ?? Self.fallbackProfile
    }

    func profile(id: String) -> DeviceProfile? {
        profiles.first { $0.id == id }
    }

    private static func loadProfiles(from bundle: Bundle) -> [DeviceProfile] {
        guard let urls = bundle.urls(forResourcesWithExtension: "json", subdirectory: "Profiles") else {
            return [fallbackProfile]
        }

        let decoder = JSONDecoder()
        return urls.compactMap { url -> DeviceProfile? in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? decoder.decode(DeviceProfile.self, from: data)
        }.sorted { $0.displayName < $1.displayName }
    }

    static let fallbackProfile = DeviceProfile(
        id: "iphone15pro_ios174",
        displayName: "iPhone 15 Pro (iOS 17.4)",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        navigator: .init(
            platform: "iPhone",
            vendor: "Apple Computer, Inc.",
            maxTouchPoints: 5,
            hardwareConcurrency: 6,
            languages: ["en-US", "en"],
            cookieEnabled: true
        ),
        screen: .init(
            width: 393, height: 852,
            availWidth: 393, availHeight: 852,
            devicePixelRatio: 3,
            colorDepth: 24,
            orientation: "portrait-primary"
        ),
        webgl: .init(
            vendor: "Apple Inc.",
            renderer: "Apple A17 Pro GPU",
            canvasNoiseSeed: 0xA17F00D
        ),
        audio: .init(sampleRate: 48000, maxChannelCount: 2),
        cameras: [
            .init(deviceId: "cam-front-15pro", groupId: "group-cam-15pro", label: "Front Camera", facingMode: "user"),
            .init(deviceId: "cam-back-triple-15pro", groupId: "group-cam-15pro", label: "Back Triple Camera", facingMode: "environment"),
            .init(deviceId: "cam-back-ultra-15pro", groupId: "group-cam-15pro", label: "Back Ultra Wide Camera", facingMode: "environment")
        ],
        microphones: [
            .init(deviceId: "mic-built-in-15pro", groupId: "group-audio-15pro", label: "iPhone Microphone")
        ],
        mediaCapabilities: .init(
            width: 1920, height: 1080,
            frameRate: 30, minFrameRate: 1, maxFrameRate: 60,
            widthMin: 320, widthMax: 1920,
            heightMin: 240, heightMax: 1080
        )
    )
}