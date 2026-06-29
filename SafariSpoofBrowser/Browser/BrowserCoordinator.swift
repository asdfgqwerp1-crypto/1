import Foundation
import WebKit
import Combine

enum BrowserLogLevel {
    case debug, info, warning, error
}

@MainActor
final class BrowserCoordinator: NSObject, ObservableObject {
    static var logLevel: BrowserLogLevel = .info

    @Published private(set) var canGoBack = false
    @Published private(set) var canGoForward = false

    private(set) var webView: WKWebView?
    private var injectionManager: InjectionManager?
    private var frameBridge: FrameBridge?
    private var activeProfile: DeviceProfile?

    func prepare(profile: DeviceProfile, frameBridge: FrameBridge) {
        self.activeProfile = profile
        self.frameBridge = frameBridge
    }

    func configure(profile: DeviceProfile, frameBridge: FrameBridge) {
        prepare(profile: profile, frameBridge: frameBridge)
        injectionManager?.updateProfile(profile)
        webView?.customUserAgent = profile.userAgent
        reinjectScripts()
    }

    func attach(webView: WKWebView) {
        self.webView = webView
        webView.navigationDelegate = self
        webView.uiDelegate = self

        guard let profile = activeProfile, let frameBridge else { return }
        let manager = InjectionManager(profile: profile, frameBridge: frameBridge)
        injectionManager = manager
        manager.install(into: webView)
        webView.customUserAgent = profile.userAgent
    }

    func load(urlString: String) {
        guard let webView else { return }
        let normalized = URLNormalizer.normalize(urlString)
        guard let url = URL(string: normalized) else { return }
        webView.load(URLRequest(url: url))
    }

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
    func reload() { webView?.reload() }

    private func reinjectScripts() {
        guard let webView, let profile = activeProfile, let frameBridge else { return }
        let manager = InjectionManager(profile: profile, frameBridge: frameBridge)
        injectionManager = manager
        manager.install(into: webView)
    }

    private func updateNavigationState() {
        canGoBack = webView?.canGoBack ?? false
        canGoForward = webView?.canGoForward ?? false
    }

    private func log(_ message: String, level: BrowserLogLevel = .info) {
        guard level.rawValue >= Self.logLevel.rawValue else { return }
        print("[Browser] \(message)")
    }
}

extension BrowserLogLevel {
    var rawValue: Int {
        switch self {
        case .debug: return 0
        case .info: return 1
        case .warning: return 2
        case .error: return 3
        }
    }
}

extension BrowserCoordinator: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        updateNavigationState()
    }
}

extension BrowserCoordinator: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        // Mimic Safari permission delay
        let delay = Double.random(in: 0.05...0.2)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            decisionHandler(.grant)
        }
    }
}