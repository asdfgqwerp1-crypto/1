import CoreImage
import CoreVideo
import Foundation

/// Uniform scale + centered crop (CSS `object-fit: cover`) for video frames.
enum FrameScaler {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    static func imageFromPixelBuffer(_ source: CVPixelBuffer) -> CIImage {
        var image = CIImage(cvPixelBuffer: source)
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

    static func renderAspectFill(from source: CVPixelBuffer, to output: CVPixelBuffer) {
        let filled = aspectFill(
            imageFromPixelBuffer(source),
            width: CVPixelBufferGetWidth(output),
            height: CVPixelBufferGetHeight(output)
        )
        ciContext.render(filled, to: output)
    }
}