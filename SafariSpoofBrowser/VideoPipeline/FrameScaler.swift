import CoreImage
import CoreVideo
import Foundation

/// Uniform scale + centered crop (CSS `object-fit: cover`) for video frames.
enum FrameScaler {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    static func imageFromPixelBuffer(_ source: CVPixelBuffer, transform: CGAffineTransform = .identity) -> CIImage {
        var image = CIImage(cvPixelBuffer: source)
        if transform != .identity {
            image = image.transformed(by: transform)
        }
        let origin = image.extent.origin
        if origin.x != 0 || origin.y != 0 {
            image = image.transformed(by: CGAffineTransform(translationX: -origin.x, y: -origin.y))
        }
        return image
    }

    static func aspectFill(_ image: CIImage, width: Int, height: Int) -> CIImage {
        var normalized = image
        let origin = normalized.extent.origin
        if origin.x != 0 || origin.y != 0 {
            normalized = normalized.transformed(by: CGAffineTransform(translationX: -origin.x, y: -origin.y))
        }
        let extent = normalized.extent
        guard extent.width > 0, extent.height > 0, width > 0, height > 0 else { return normalized }

        let scale = max(CGFloat(width) / extent.width, CGFloat(height) / extent.height)
        let scaled = normalized.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let scaledExtent = scaled.extent
        let cropRect = CGRect(
            x: scaledExtent.midX - CGFloat(width) * 0.5,
            y: scaledExtent.midY - CGFloat(height) * 0.5,
            width: CGFloat(width),
            height: CGFloat(height)
        )
        return scaled.cropped(to: cropRect)
    }

    static func renderAspectFill(
        from source: CVPixelBuffer,
        to output: CVPixelBuffer,
        transform: CGAffineTransform = .identity
    ) {
        let outW = CVPixelBufferGetWidth(output)
        let outH = CVPixelBufferGetHeight(output)
        let filled = aspectFill(imageFromPixelBuffer(source, transform: transform), width: outW, height: outH)
        guard let cgImage = ciContext.createCGImage(filled, from: filled.extent) else { return }

        CVPixelBufferLockBaseAddress(output, [])
        defer { CVPixelBufferUnlockBaseAddress(output, []) }

        guard let base = CVPixelBufferGetBaseAddress(output) else { return }
        guard let context = CGContext(
            data: base,
            width: outW,
            height: outH,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(output),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { return }

        context.clear(CGRect(x: 0, y: 0, width: outW, height: outH))
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: outW, height: outH))
    }
}