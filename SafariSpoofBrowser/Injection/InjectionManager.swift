import WebKit

final class InjectionManager {
    private var profile: DeviceProfile
    private let frameBridge: FrameBridge
    private let scriptLoader: InjectionScriptLoader

    init(profile: DeviceProfile, frameBridge: FrameBridge, scriptLoader: InjectionScriptLoader = InjectionScriptLoader()) {
        self.profile = profile
        self.frameBridge = frameBridge
        self.scriptLoader = scriptLoader
    }

    func updateProfile(_ profile: DeviceProfile) {
        self.profile = profile
    }

    func install(into webView: WKWebView) {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()

        let scripts = scriptLoader.loadBundledScripts(
            configJSON: profile.injectionConfigJSON,
            debugConsoleEnabled: DebugSettings.consoleEnabled
        )
        for source in scripts {
            let script = WKUserScript(
                source: source,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false,
                in: .page
            )
            controller.addUserScript(script)
        }

        if let reporter = scriptLoader.loadModule(named: "media/frameReporter") {
            let endScript = WKUserScript(
                source: reporter,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: false,
                in: .page
            )
            controller.addUserScript(endScript)
        }
    }
}