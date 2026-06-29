import Foundation

struct ChunkedNV12Frame {
    static let chunkByteSize = 49_152

    let sequence: UInt64
    let width: Int
    let height: Int
    let presentationTimeUs: UInt64
    let chunks: [Data]

    var chunkCount: Int { chunks.count }

    init(sequence: UInt64, width: Int, height: Int, presentationTimeUs: UInt64, data: Data) {
        self.sequence = sequence
        self.width = width
        self.height = height
        self.presentationTimeUs = presentationTimeUs
        if data.isEmpty {
            chunks = []
        } else {
            var parts: [Data] = []
            var offset = 0
            while offset < data.count {
                let end = min(offset + Self.chunkByteSize, data.count)
                parts.append(data.subdata(in: offset..<end))
                offset = end
            }
            chunks = parts
        }
    }

    func metaFrame() -> SpoofFrame {
        SpoofFrame(
            data: Data(),
            format: .nv12,
            width: width,
            height: height,
            sequence: sequence,
            presentationTimeUs: presentationTimeUs
        )
    }
}