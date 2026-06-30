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
    private var controlMessageHandler: SpoofControlMessageHandler?
    private var activeProfile: DeviceProfile?

    var onPageUpdate: ((String, String?) -> Void)?

    var exportBridgeForSetup: ExportBridge { exportBridge }

    func retainControlMessageHandler(_ handler: SpoofControlMessageHandler) {
        controlMessageHandler = handler
    }

    func prepare(profile: DeviceProfile, frameBridge: FrameBridge) {
        self.activeProfile = profile
        self.frameBridge = frameBridge
        frameBridge.setSchemeAuthKey(profile.schemeAuthKey)
        frameBridge.controlSchemeHandler.exportBridge = exportBridge
    }

    func configure(profile: DeviceProfile, frameBridge: FrameBridge) {
        prepare(profile: profile, frameBridge: frameBridge)
        injectionManager?.updateProfile(profile)
        webView?.customUserAgent = profile.userAgent
        reinjectScripts()
    }

    func attach(webView: WKWebView, frameBridgeActive: Bool = true) {
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
        if frameBridgeActive {
            frameBridge.attach(webView: webView)
        }
        webView.customUserAgent = profile.userAgent
        statusMessage = "Браузер готов"
        DebugLogStore.shared.append(
            level: "info",
            message: "[native] browser attach \(BuildInfo.marker), injection in page world"
        )
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
        if let url = webView.url?.absoluteString {
            DebugLogStore.shared.append(level: "info", message: "[native] didFinish \(url)")
            onPageUpdate?(url, webView.title)
        }
        webView.evaluateJavaScript(Self.rehookInjectionScript) { _, error in
            if let error {
                DebugLogStore.shared.append(level: "error", message: "[native] rehook err: \(error.localizedDescription)")
            }
        }
        runIframeMaintenance(on: webView, label: "main")
        DebugLogStore.shared.append(level: "info", message: "[native] probe scheduled \(BuildInfo.marker)")
        runInjectionProbe(on: webView, label: "main")
        for delay in [2.0, 5.0, 10.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak webView] in
                guard let webView else { return }
                self.runInjectionProbe(on: webView, label: "t+\(Int(delay))s")
                self.runIframeMaintenance(on: webView, label: "t+\(Int(delay))s")
            }
        }
    }

    private func runIframeMaintenance(on webView: WKWebView, label: String) {
        webView.evaluateJavaScript(Self.iframeAllowPatchScript) { result, error in
            if let error {
                DebugLogStore.shared.append(level: "error", message: "[native] iframe patch(\(label)) err: \(error.localizedDescription)")
                return
            }
            if let json = result as? String, !json.isEmpty {
                DebugLogStore.shared.append(level: "info", message: "[native] iframe patch(\(label)) \(json)")
            }
        }
        webView.evaluateJavaScript(Self.iframeAuditScript) { result, error in
            if let error {
                DebugLogStore.shared.append(level: "error", message: "[native] iframe audit(\(label)) err: \(error.localizedDescription)")
                return
            }
            if let json = result as? String, !json.isEmpty {
                DebugLogStore.shared.append(level: "info", message: "[native] iframe audit(\(label)) \(json)")
            }
        }
    }

    private func runInjectionProbe(on webView: WKWebView, label: String) {
        webView.evaluateJavaScript(Self.injectionProbeScript) { result, error in
            if let error {
                DebugLogStore.shared.append(level: "error", message: "[native] probe(\(label)) err: \(error.localizedDescription)")
                return
            }
            let json = (result as? String) ?? String(describing: result ?? "nil")
            DebugLogStore.shared.append(
                level: "info",
                message: "[native] probe(\(label)) \(json.isEmpty ? "(empty)" : json)"
            )
        }
    }

    private static let rehookInjectionScript = """
    (function(){try{
      if(window.__spoofHookNavigatorMediaDevices)window.__spoofHookNavigatorMediaDevices();
      if(window.__spoofPatchAllIframes)window.__spoofPatchAllIframes();
      if(window.__spoofTrace)window.__spoofTrace('info','didFinish rehook @ '+(location.href||''),'inject');
    }catch(e){}})();
    """

    private static let iframeAllowPatchScript = """
    (function(){try{
      if(window.__spoofPatchAllIframes)return JSON.stringify(window.__spoofPatchAllIframes());
      var allow='camera; microphone; autoplay; fullscreen; display-capture';
      var patched=0,total=0;
      document.querySelectorAll('iframe').forEach(function(f){
        total+=1;
        var prev=f.getAttribute('allow')||'';
        if(prev.indexOf('camera')<0){f.setAttribute('allow',allow);if(f.allow!==undefined)f.allow=allow;patched+=1;}
      });
      return JSON.stringify({patched:patched,total:total,fallback:true});
    }catch(e){return JSON.stringify({error:String(e)});}})();
    """

    private static let iframeAuditScript = """
    (function(){try{
      var frames=Array.from(document.querySelectorAll('iframe')).filter(function(f){
        var s=(f.src||f.getAttribute('src')||'');
        return s.indexOf('spoofcontrol://')!==0;
      });
      var list=frames.slice(0,12).map(function(f,i){
        return {i:i,src:(f.src||f.getAttribute('src')||'').slice(0,72),allow:(f.getAttribute('allow')||'').slice(0,48)};
      });
      return JSON.stringify({count:frames.length,frames:list});
    }catch(e){return JSON.stringify({error:String(e)});}})();
    """

    private static let injectionProbeScript = """
    (function(){try{
      var md=navigator.mediaDevices;
      return JSON.stringify({
        href:location.href,
        top:window===window.top,
        installed:!!window.__safariSpoofInstalled,
        patched:!!(md&&md.__spoofMediaPatched),
        send:typeof window.__spoofSendControl,
        trace:typeof window.__spoofTrace,
        secure:!!window.isSecureContext
      });
    }catch(e){return JSON.stringify({error:String(e)});}})();
    """

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
        let kind: String
        switch type {
        case .camera: kind = "camera"
        case .microphone: kind = "microphone"
        case .cameraAndMicrophone: kind = "camera+mic"
        @unknown default: kind = "media"
        }
        let host = origin.host
        DebugLogStore.shared.append(
            level: "info",
            message: "[native] WK grant \(kind) from \(host) mainFrame=\(frame.isMainFrame)"
        )
        let delay = Double.random(in: 0.05...0.2)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            decisionHandler(.grant)
        }
    }
}