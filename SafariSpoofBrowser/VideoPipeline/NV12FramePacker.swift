import AVFoundation
import CoreImage
import CoreVideo
import Foundation
import QuartzCore

enum NV12FramePacker {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    static func scaledNV12Buffer(from source: CVPixelBuffer, width: Int, height: Int) -> CVPixelBuffer? {
        let attrs: [String: Any] = [
            kCVPixelBufferIOSurfacePropertiesKey as String: [:]
        ]
        var output: CVPixelBuffer?
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            width,
            height,
            kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
            attrs as CFDictionary,
            &output
        )
        guard status == kCVReturnSuccess, let output else { return nil }

        let image = CIImage(cvPixelBuffer: source)
        let scaleX = CGFloat(width) / image.extent.width
        let scaleY = CGFloat(height) / image.extent.height
        let scaled = image.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
        ciContext.render(scaled, to: output)
        return output
    }

    /// Tightly packed NV12: Y plane (w×h) + interleaved UV (w×h/2).
    static func pack(_ buffer: CVPixelBuffer) -> Data? {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }

        guard CVPixelBufferGetPlaneCount(buffer) >= 2 else { return nil }
        let width = CVPixelBufferGetWidth(buffer)
        let height = CVPixelBufferGetHeight(buffer)
        let yRowBytes = CVPixelBufferGetBytesPerRowOfPlane(buffer, 0)
        let uvRowBytes = CVPixelBufferGetBytesPerRowOfPlane(buffer, 1)
        guard let yBase = CVPixelBufferGetBaseAddressOfPlane(buffer, 0),
              let uvBase = CVPixelBufferGetBaseAddressOfPlane(buffer, 1) else { return nil }

        var data = Data(capacity: width * height * 3 / 2)
        for row in 0..<height {
            data.append(Data(bytes: yBase.advanced(by: row * yRowBytes), count: width))
        }
        let uvHeight = height / 2
        for row in 0..<uvHeight {
            data.append(Data(bytes: uvBase.advanced(by: row * uvRowBytes), count: width))
        }
        return data
    }

    static func presentationTimeUs(from sampleBuffer: CMSampleBuffer) -> UInt64 {
        let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        guard pts.timescale > 0 else {
            return UInt64(CACurrentMediaTime() * 1_000_000)
        }
        return UInt64((Double(pts.value) / Double(pts.timescale)) * 1_000_000)
    }
}