import Foundation

struct DeviceProfile: Codable, Identifiable, Equatable {
    let id: String
    let displayName: String
    let userAgent: String
    let emulateSafariObject: Bool?
    let navigator: NavigatorProfile
    let screen: ScreenProfile
    let webgl: WebGLProfile
    let audio: AudioProfile
    let cameras: [CameraDevice]
    let microphones: [AudioDevice]
    let mediaCapabilities: MediaCapabilities
    let videoTrackSpoof: VideoTrackSpoof?
    let audioTrackSpoof: AudioTrackSpoof?

    struct NavigatorProfile: Codable, Equatable {
        let platform: String
        let vendor: String
        let maxTouchPoints: Int
        let hardwareConcurrency: Int
        let languages: [String]
        let cookieEnabled: Bool
        let webdriver: Bool?
    }

    struct ViewportProfile: Codable, Equatable {
        let innerWidth: Int
        let innerHeight: Int
        let outerWidth: Int?
        let outerHeight: Int?
    }

    struct ScreenProfile: Codable, Equatable {
        let width: Int
        let height: Int
        let availWidth: Int
        let availHeight: Int
        let devicePixelRatio: Double
        let colorDepth: Int
        let orientation: String
        let viewport: ViewportProfile?
    }

    struct WebGLProfile: Codable, Equatable {
        let vendor: String
        let renderer: String
        let canvasNoiseSeed: UInt32
    }

    struct AudioProfile: Codable, Equatable {
        let sampleRate: Double
        let maxChannelCount: Int
    }

    struct CameraDevice: Codable, Equatable {
        let deviceId: String
        let groupId: String
        let label: String
        let facingMode: String
    }

    struct AudioDevice: Codable, Equatable {
        let deviceId: String
        let groupId: String
        let label: String
    }

    struct MediaCapabilities: Codable, Equatable {
        let width: Int
        let height: Int
        let frameRate: Double
        let minFrameRate: Double
        let maxFrameRate: Double
        let widthMin: Int
        let widthMax: Int
        let heightMin: Int
        let heightMax: Int
    }

    struct VideoTrackSpoof: Codable, Equatable {
        let settings: VideoTrackSettings
        let capabilities: VideoTrackCapabilities
    }

    struct VideoTrackSettings: Codable, Equatable {
        let aspectRatio: Double
        let backgroundBlur: Bool
        let powerEfficient: Bool
        let whiteBalanceMode: String
        let zoom: Double
    }

    struct VideoTrackCapabilities: Codable, Equatable {
        let aspectRatioMin: Double
        let aspectRatioMax: Double
        let backgroundBlur: [Bool]
        let powerEfficient: [Bool]
        let whiteBalanceMode: [String]
        let zoomMin: Double
        let zoomMax: Double
    }

    struct AudioTrackSpoof: Codable, Equatable {
        let settings: AudioTrackSettings
        let capabilities: AudioTrackCapabilities
    }

    struct AudioTrackSettings: Codable, Equatable {
        let echoCancellation: Bool
        let volume: Double
    }

    struct AudioTrackCapabilities: Codable, Equatable {
        let echoCancellation: [Bool]
        let sampleRateMin: Int
        let sampleRateMax: Int
        let volumeMin: Double
        let volumeMax: Double
    }

    var injectionConfigJSON: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(InjectionConfig(profile: self)),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }
}

private struct InjectionConfig: Encodable {
    let profileId: String
    let emulateSafariObject: Bool?
    let navigator: DeviceProfile.NavigatorProfile
    let screen: DeviceProfile.ScreenProfile
    let webgl: DeviceProfile.WebGLProfile
    let audio: DeviceProfile.AudioProfile
    let cameras: [DeviceProfile.CameraDevice]
    let microphones: [DeviceProfile.AudioDevice]
    let mediaCapabilities: DeviceProfile.MediaCapabilities
    let videoTrackSpoof: DeviceProfile.VideoTrackSpoof?
    let audioTrackSpoof: DeviceProfile.AudioTrackSpoof?

    init(profile: DeviceProfile) {
        profileId = profile.id
        emulateSafariObject = profile.emulateSafariObject
        navigator = profile.navigator
        screen = profile.screen
        webgl = profile.webgl
        audio = profile.audio
        cameras = profile.cameras
        microphones = profile.microphones
        mediaCapabilities = profile.mediaCapabilities
        videoTrackSpoof = profile.videoTrackSpoof
        audioTrackSpoof = profile.audioTrackSpoof
    }
}