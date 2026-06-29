import Foundation

final class ProfileStore {
    static let preferredDefaultId = "iphone11_ios265"

    let profiles: [DeviceProfile]
    let defaultProfile: DeviceProfile

    init(bundle: Bundle = .main) {
        profiles = Self.loadProfiles(from: bundle)
        defaultProfile = profiles.first { $0.id == Self.preferredDefaultId }
            ?? profiles.first
            ?? Self.fallbackProfile
    }

    func profile(id: String) -> DeviceProfile? {
        profiles.first { $0.id == id }
    }

    private static func loadProfiles(from bundle: Bundle) -> [DeviceProfile] {
        let urls = profileJSONURLs(in: bundle)
        guard !urls.isEmpty else {
            return [fallbackProfile]
        }

        let decoder = JSONDecoder()
        let loaded = urls.compactMap { url -> DeviceProfile? in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? decoder.decode(DeviceProfile.self, from: data)
        }

        return loaded.isEmpty ? [fallbackProfile] : loaded.sorted { $0.displayName < $1.displayName }
    }

    private static func profileJSONURLs(in bundle: Bundle) -> [URL] {
        var urls: [URL] = []
        let subdirectories = ["Profiles", "Profiles/Profiles", nil]
        for subdirectory in subdirectories {
            if let found = bundle.urls(forResourcesWithExtension: "json", subdirectory: subdirectory) {
                urls.append(contentsOf: found)
            }
        }
        return Array(Set(urls))
    }

    static let fallbackProfile = DeviceProfile(
        id: "iphone11_ios265",
        displayName: "iPhone 11 (iOS 26.5) fallback",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1",
        emulateSafariObject: false,
        frameDelivery: .nv12,
        navigator: .init(
            platform: "iPhone",
            vendor: "Apple Computer, Inc.",
            maxTouchPoints: 5,
            hardwareConcurrency: 4,
            languages: ["en-US"],
            cookieEnabled: true,
            webdriver: false
        ),
        screen: .init(
            width: 414, height: 896,
            availWidth: 414, availHeight: 896,
            devicePixelRatio: 2,
            colorDepth: 24,
            orientation: "portrait-primary",
            viewport: .init(innerWidth: 414, innerHeight: 750, outerWidth: 414, outerHeight: 896)
        ),
        webgl: .init(
            vendor: "Apple Inc.",
            renderer: "Apple GPU",
            canvasNoiseSeed: 284739102
        ),
        audio: .init(sampleRate: 48000, maxChannelCount: 2),
        cameras: [
            .init(deviceId: "43235B3AEE3C4362D299A1CC7BDC8308989ACDE5", groupId: "F5F15701812711DD47DDA7E4B3CDE50BA35BC0DB", label: "Front Camera", facingMode: "user"),
            .init(deviceId: "8A2C4F1B9D3E5670A1B2C3D4E5F60718293A4B5C", groupId: "F5F15701812711DD47DDA7E4B3CDE50BA35BC0DB", label: "Back Camera", facingMode: "environment")
        ],
        microphones: [
            .init(deviceId: "E4106AE4B839EB00F2EF887103F6D500040F6E0E", groupId: "1E7BD4C66DFD0CCDFC449FAE7C1E73C477D052BF", label: "iPhone Microphone")
        ],
        mediaCapabilities: .init(
            width: 480, height: 640,
            frameRate: 30, minFrameRate: 1, maxFrameRate: 60,
            widthMin: 1, widthMax: 4032,
            heightMin: 1, heightMax: 3024
        ),
        videoTrackSpoof: nil,
        audioTrackSpoof: nil
    )
}