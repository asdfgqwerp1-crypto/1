import SwiftUI
import WebKit

struct BrowserView: UIViewRepresentable {
    @ObservedObject var coordinator: BrowserCoordinator

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        coordinator.attach(webView: webView)
        coordinator.load(urlString: "https://www.apple.com")
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}