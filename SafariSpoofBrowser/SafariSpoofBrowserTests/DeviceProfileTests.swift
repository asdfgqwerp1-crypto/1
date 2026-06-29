import XCTest
@testable import SafariSpoofBrowser

final class DeviceProfileTests: XCTestCase {
    func testFallbackProfileValid() {
        let profile = ProfileStore.fallbackProfile
        XCTAssertEqual(profile.id, "iphone15pro_ios174")
        XCTAssertFalse(profile.userAgent.isEmpty)
        XCTAssertFalse(profile.cameras.isEmpty)
    }

    func testInjectionConfigJSON() {
        let profile = ProfileStore.fallbackProfile
        let json = profile.injectionConfigJSON
        XCTAssertTrue(json.contains("profileId"))
        XCTAssertTrue(json.contains("iphone15pro_ios174"))
    }

    func testURLNormalizer() {
        XCTAssertEqual(URLNormalizer.normalize("example.com"), "https://example.com")
        XCTAssertEqual(URLNormalizer.normalize("https://test.com"), "https://test.com")
        XCTAssertEqual(URLNormalizer.normalize("  "), "about:blank")
    }
}