import SwiftUI
import WebKit

struct BrowserView: UIViewRepresentable {
    @ObservedObject var coordinator: BrowserCoordinator
    let profile: DeviceProfile
    let frameBridge: FrameBridge

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        webView.allowsBackForwardNavigationGestures = true

        coordinator.prepare(profile: profile, frameBridge: frameBridge)
        coordinator.attach(webView: webView)

        if let welcome = Bundle.main.url(forResource: "welcome", withExtension: "html") {
            webView.loadFileURL(welcome, allowingReadAccessTo: welcome.deletingLastPathComponent())
        } else {
            coordinator.load(urlString: "https://www.apple.com")
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        coordinator.prepare(profile: profile, frameBridge: frameBridge)
    }
}