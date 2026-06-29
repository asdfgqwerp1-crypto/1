import CoreImage
import CoreVideo
import Foundation

/// Uniform scale + centered crop (CSS `object-fit: cover`) for video frames.
enum FrameScaler {
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    static func aspectFill(_ image: CIImage, width: Int, height: Int) -> CIImage {
        let extent = image.extent
        guard extent.width > 0, extent.height > 0, width > 0, height > 0 else { return image }

        let scale = max(CGFloat(width) / extent.width, CGFloat(height) / extent.height)
        let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
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
        let image = CIImage(cvPixelBuffer: source)
        let filled = aspectFill(image, width: CVPixelBufferGetWidth(output), height: CVPixelBufferGetHeight(output))
        ciContext.render(filled, to: output)
    }
}