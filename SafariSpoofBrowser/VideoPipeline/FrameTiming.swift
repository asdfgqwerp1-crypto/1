import Foundation

struct FrameTiming: Codable, Equatable {
    let targetFrameRate: Double
    let minDeliverFps: Double?
    let jitterMsMin: Double?
    let jitterMsMax: Double?
    let exposureHitchInterval: UInt64?
    let exposureHitchMsMin: Double?
    let exposureHitchMsMax: Double?
    let slowdownProbability: Double?
    let slowdownFactorMin: Double?
    let slowdownFactorMax: Double?

    static let iphoneDefault = FrameTiming(
        targetFrameRate: 30,
        minDeliverFps: 24,
        jitterMsMin: -6,
        jitterMsMax: 10,
        exposureHitchInterval: 90,
        exposureHitchMsMin: 5,
        exposureHitchMsMax: 15,
        slowdownProbability: 0.02,
        slowdownFactorMin: 1.12,
        slowdownFactorMax: 1.28
    )

    var baseIntervalSeconds: CFAbsoluteTime {
        1.0 / max(targetFrameRate, 1)
    }

    func nextIntervalSeconds(frameIndex: UInt64) -> CFAbsoluteTime {
        let jitterMin = jitterMsMin ?? -6
        let jitterMax = jitterMsMax ?? 10
        var ms = (baseIntervalSeconds * 1000) + Double.random(in: jitterMin...jitterMax)

        let hitchInterval = exposureHitchInterval ?? 90
        if hitchInterval > 0, frameIndex > 0, frameIndex % hitchInterval == 0 {
            ms += Double.random(in: (exposureHitchMsMin ?? 5)...(exposureHitchMsMax ?? 15))
        }

        let slowdownChance = slowdownProbability ?? 0
        if slowdownChance > 0, Double.random(in: 0...1) < slowdownChance {
            ms *= Double.random(in: (slowdownFactorMin ?? 1.12)...(slowdownFactorMax ?? 1.28))
        }

        let minIntervalMs = 1000.0 / max(minDeliverFps ?? 24, 1)
        return max(ms, minIntervalMs) / 1000.0
    }
}

struct StreamDeliveryConfig: Equatable {
    let width: Int
    let height: Int
    let frameRate: Double
}