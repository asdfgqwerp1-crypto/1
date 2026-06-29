import XCTest
@testable import SafariSpoofBrowser

final class DeviceProfileTests: XCTestCase {
    func testFallbackProfileValid() {
        let profile = ProfileStore.fallbackProfile
        XCTAssertEqual(profile.id, "iphone11_ios265")
        XCTAssertFalse(profile.userAgent.isEmpty)
        XCTAssertEqual(profile.cameras.count, 2)
    }

    func testDefaultProfilePrefersIPhone11() {
        let store = ProfileStore()
        XCTAssertEqual(store.defaultProfile.id, "iphone11_ios265")
    }

    func testInjectionConfigJSON() {
        let profile = ProfileStore.fallbackProfile
        let json = profile.injectionConfigJSON
        XCTAssertTrue(json.contains("profileId"))
        XCTAssertTrue(json.contains("iphone11_ios265"))
    }

    func testURLNormalizer() {
        XCTAssertEqual(URLNormalizer.normalize("example.com"), "https://example.com")
        XCTAssertEqual(URLNormalizer.normalize("https://test.com"), "https://test.com")
        XCTAssertEqual(URLNormalizer.normalize("  "), "about:blank")
    }
}