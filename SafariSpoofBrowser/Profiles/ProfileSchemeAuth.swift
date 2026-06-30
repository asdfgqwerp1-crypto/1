import CryptoKit
import Foundation

enum ProfileSchemeAuth {
    /// Stable per-profile key so page probes without `k=` fail like unknown URL schemes in Safari.
    static func key(for profileId: String) -> String {
        let digest = SHA256.hash(data: Data("safarispoof.scheme.\(profileId)".utf8))
        return digest.prefix(8).map { String(format: "%02x", $0) }.joined()
    }
}