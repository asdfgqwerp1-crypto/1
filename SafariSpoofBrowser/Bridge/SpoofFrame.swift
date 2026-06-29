import Foundation

enum SpoofFrameFormat: String {
    case nv12
    case jpeg
}

struct SpoofFrame {
    let data: Data
    let format: SpoofFrameFormat
    let width: Int
    let height: Int
    let sequence: UInt64
    let presentationTimeUs: UInt64
}