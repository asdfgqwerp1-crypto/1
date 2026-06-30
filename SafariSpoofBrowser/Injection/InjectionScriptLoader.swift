import Foundation

final class InjectionScriptLoader {
    private let moduleOrder = [
        "fingerprint/webkit-stealth",
        "bootstrap",
        "fingerprint/navigator",
        "fingerprint/screen",
        "fingerprint/webgl",
        "fingerprint/canvas",
        "fingerprint/audio",
        "media/frameReceiver",
        "media/mediaStreamMock",
        "media/getUserMedia",
        "webrtc/enumerateDevices"
    ]

    func loadBundledScripts(configJSON: String, debugConsoleEnabled: Bool = false) -> [String] {
        let bootstrap = """
        (function() {
            'use strict';
            if (window.__safariSpoofInstalled) return;
            window.__safariSpoofInstalled = true;
            window.__SAFARI_SPOOF_CONFIG__ = \(configJSON);
        })();
        """

        var scripts = [bootstrap]

        for module in moduleOrder where module != "bootstrap" {
            if let source = loadModule(named: module) {
                scripts.append(source)
            }
        }

        if debugConsoleEnabled, let debugScript = loadModule(named: "fingerprint/debug-console") {
            scripts.append(debugScript)
        }

        return scripts
    }

    private func loadModule(named name: String) -> String? {
        let flatName = (name as NSString).lastPathComponent
        let subdirs = [
            "injection/\((name as NSString).deletingLastPathComponent)",
            "injection",
            nil
        ]

        for subdir in subdirs {
            if let url = Bundle.main.url(forResource: flatName, withExtension: "js", subdirectory: subdir),
               let content = try? String(contentsOf: url, encoding: .utf8) {
                return content
            }
        }

        // Development fallback: load from project Resources when running tests
        #if DEBUG
        let devPath = Bundle.main.bundlePath
            .replacingOccurrences(of: ".app", with: "")
            .appending("/../Resources/injection/\(name).js")
        if let content = try? String(contentsOf: URL(fileURLWithPath: devPath), encoding: .utf8) {
            return content
        }
        #endif

        return nil
    }
}