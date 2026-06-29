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
        webView.allowsBackForwardNavigationGestures = true

        coordinator.prepare(profile: profile, frameBridge: frameBridge)
        coordinator.attach(webView: webView)
        loadWelcomePage(in: webView)

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        coordinator.prepare(profile: profile, frameBridge: frameBridge)
    }

    private func loadWelcomePage(in webView: WKWebView) {
        if let url = Bundle.main.url(forResource: "welcome", withExtension: "html"),
           let html = try? String(contentsOf: url, encoding: .utf8) {
            webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
            return
        }

        let fallback = """
        <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:-apple-system,sans-serif;padding:24px;background:#fff;color:#111}</style></head>
        <body><h1>SafariSpoof Browser</h1><p>Введите URL теста в адресной строке.</p></body></html>
        """
        webView.loadHTMLString(fallback, baseURL: nil)
    }
}