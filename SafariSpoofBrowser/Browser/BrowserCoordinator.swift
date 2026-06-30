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
    @Published private(set) var isLoading = false
    @Published private(set) var statusMessage = "Готов"

    private(set) var webView: WKWebView?
    private var injectionManager: InjectionManager?
    private var frameBridge: FrameBridge?
    private let exportBridge = ExportBridge()
    private var activeProfile: DeviceProfile?

    func prepare(profile: DeviceProfile, frameBridge: FrameBridge) {
        self.activeProfile = profile
        self.frameBridge = frameBridge
        frameBridge.controlSchemeHandler.exportBridge = exportBridge
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

        guard let profile = activeProfile, let frameBridge else {
            statusMessage = "Ошибка: профиль не готов"
            return
        }
        let manager = InjectionManager(profile: profile, frameBridge: frameBridge)
        injectionManager = manager
        exportBridge.attach(webView: webView)

        manager.install(into: webView)
        frameBridge.attach(webView: webView)
        webView.customUserAgent = profile.userAgent
        statusMessage = "Браузер готов"
    }

    func load(urlString: String) {
        guard let webView else {
            statusMessage = "Ошибка: WebView не создан"
            return
        }
        let normalized = URLNormalizer.normalize(urlString)
        guard let url = URL(string: normalized) else {
            statusMessage = "Неверный URL"
            return
        }
        isLoading = true
        statusMessage = "Загрузка \(url.host ?? normalized)…"
        webView.load(URLRequest(url: url))
    }

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
    func reload() { webView?.reload() }

    func refreshInjection() {
        reinjectScripts()
        statusMessage = DebugSettings.consoleEnabled ? "Debug console включена" : "Браузер готов"
    }

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
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        statusMessage = webView.url?.host ?? "Загружено"
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        statusMessage = "Ошибка: \(error.localizedDescription)"
        log(statusMessage, level: .error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        statusMessage = "Не открылось: \(error.localizedDescription)"
        log(statusMessage, level: .error)
    }

    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let trust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: trust))
            return
        }
        completionHandler(.performDefaultHandling, nil)
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
        let delay = Double.random(in: 0.05...0.2)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            decisionHandler(.grant)
        }
    }
}