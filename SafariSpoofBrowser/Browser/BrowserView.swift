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
        frameBridge.registerScheme(on: configuration)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = true
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white
        webView.scrollView.isOpaque = true
        webView.allowsBackForwardNavigationGestures = true

        coordinator.prepare(profile: profile, frameBridge: frameBridge)
        coordinator.attach(webView: webView)

        if let blank = URL(string: "about:blank") {
            webView.load(URLRequest(url: blank))
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        coordinator.prepare(profile: profile, frameBridge: frameBridge)
    }
}