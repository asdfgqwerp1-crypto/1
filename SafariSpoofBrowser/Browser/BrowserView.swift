import SwiftUI
import WebKit

struct BrowserView: UIViewRepresentable {
    @ObservedObject var coordinator: BrowserCoordinator
    let profile: DeviceProfile
    let frameBridge: FrameBridge
    var initialURL: String?

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let pagePrefs = WKWebpagePreferences()
        pagePrefs.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences = pagePrefs
        frameBridge.registerSchemes(on: configuration)

        let controlHandler = SpoofControlMessageHandler()
        controlHandler.frameBridge = frameBridge
        controlHandler.exportBridge = coordinator.exportBridgeForSetup
        configuration.userContentController.add(
            controlHandler,
            name: SpoofControlMessageHandler.handlerName
        )
        coordinator.retainControlMessageHandler(controlHandler)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        #if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
        #endif
        webView.isOpaque = true
        webView.backgroundColor = .white
        webView.scrollView.backgroundColor = .white
        webView.scrollView.isOpaque = true
        webView.allowsBackForwardNavigationGestures = true

        coordinator.prepare(profile: profile, frameBridge: frameBridge)
        coordinator.attach(webView: webView)

        DispatchQueue.main.async {
            if let initialURL, !initialURL.isEmpty {
                coordinator.load(urlString: initialURL)
            } else if let blank = URL(string: "about:blank") {
                webView.load(URLRequest(url: blank))
            }
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        coordinator.prepare(profile: profile, frameBridge: frameBridge)
    }
}