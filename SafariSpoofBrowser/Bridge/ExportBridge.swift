import UIKit
import WebKit

final class ExportBridge: NSObject {
    private weak var webView: WKWebView?

    func attach(webView: WKWebView) {
        self.webView = webView
    }

    func handleExport(filename: String, json: String) {
        DispatchQueue.main.async { [weak self] in
            self?.presentShareSheet(json: json, filename: filename)
        }
    }

    private func presentShareSheet(json: String, filename: String) {
        guard let webView,
              let presenter = webView.window?.rootViewController?.presentedViewController
                ?? webView.window?.rootViewController else { return }

        let safeName = filename.isEmpty ? "report.json" : filename
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
        do {
            try json.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            let activity = UIActivityViewController(activityItems: [json], applicationActivities: nil)
            presenter.present(activity, animated: true)
            return
        }

        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let popover = activity.popoverPresentationController {
            popover.sourceView = webView
            popover.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
        }
        presenter.present(activity, animated: true)
    }
}