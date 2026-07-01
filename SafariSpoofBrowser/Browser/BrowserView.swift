import SwiftUI
import WebKit

struct BrowserView: UIViewRepresentable {
    typealias Coordinator = BrowserViewHost

    @ObservedObject var coordinator: BrowserCoordinator
    let tab: TabSession
    let profile: DeviceProfile
    let frameBridge: FrameBridge
    let dataStoreRegistry: TabDataStoreRegistry
    let isActive: Bool

    func makeCoordinator() -> BrowserViewHost {
        BrowserViewHost()
    }

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .white
        context.coordinator.container = container
        context.coordinator.tabID = tab.id
        loadWebViewIfNeeded(context: context)
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        coordinator.prepare(profile: profile, frameBridge: frameBridge)
        context.coordinator.tabID = tab.id

        if context.coordinator.loadedTabID != tab.id {
            context.coordinator.webView?.removeFromSuperview()
            context.coordinator.webView = nil
            context.coordinator.loadedTabID = nil
            loadWebViewIfNeeded(context: context)
            return
        }

        guard let webView = context.coordinator.webView else { return }
        webView.isHidden = !isActive
        webView.isUserInteractionEnabled = isActive
        frameBridge.attach(webView: webView)
        if isActive {
            coordinator.configure(profile: profile, frameBridge: frameBridge)
        }
    }

    private func loadWebViewIfNeeded(context: Context) {
        guard context.coordinator.webView == nil else { return }
        dataStoreRegistry.dataStore(for: tab.id, ephemeral: tab.isEphemeral) { store in
            DispatchQueue.main.async {
                guard context.coordinator.container != nil,
                      context.coordinator.tabID == tab.id,
                      context.coordinator.webView == nil else { return }

                let configuration = WKWebViewConfiguration()
                configuration.websiteDataStore = store
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
                webView.translatesAutoresizingMaskIntoConstraints = false
                webView.isHidden = !isActive
                webView.isUserInteractionEnabled = isActive

                if let container = context.coordinator.container {
                    container.addSubview(webView)
                    NSLayoutConstraint.activate([
                        webView.topAnchor.constraint(equalTo: container.topAnchor),
                        webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
                        webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                        webView.trailingAnchor.constraint(equalTo: container.trailingAnchor)
                    ])
                }

                context.coordinator.webView = webView
                context.coordinator.loadedTabID = tab.id
                coordinator.prepare(profile: profile, frameBridge: frameBridge)
                frameBridge.attach(webView: webView)
                coordinator.attach(webView: webView, frameBridgeActive: isActive)

                if !tab.url.isEmpty {
                    coordinator.load(urlString: tab.url)
                } else if let blank = URL(string: "about:blank") {
                    webView.load(URLRequest(url: blank))
                }
            }
        }
    }
}

final class BrowserViewHost {
    weak var container: UIView?
    weak var webView: WKWebView?
    var tabID: UUID?
    var loadedTabID: UUID?
}