import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showBrowser = false
    @State private var addressText = ""

    var body: some View {
        HomeView(onOpenURL: openBrowser)
            .preferredColorScheme(.light)
            .fullScreenCover(isPresented: $showBrowser, onDismiss: {
                appState.tabCoordinator.persistNow()
                appState.stopVideoPipeline()
            }) {
                BrowserScreenView(
                    tabCoordinator: appState.tabCoordinator,
                    addressText: $addressText,
                    onClose: { showBrowser = false },
                    onNavigate: { url in
                        addressText = url
                        appState.tabCoordinator.updateTab(appState.tabCoordinator.activeTabID, url: url, title: nil)
                        appState.tabCoordinator.activeCoordinator?.load(urlString: url)
                    }
                )
                .environmentObject(appState)
            }
            .sheet(isPresented: $appState.showSettings) {
                SettingsView()
                    .environmentObject(appState)
            }
    }

    private func openBrowser(url: String) {
        addressText = url
        if appState.tabCoordinator.activeTab != nil {
            appState.tabCoordinator.updateTab(appState.tabCoordinator.activeTabID, url: url, title: nil)
        } else {
            appState.tabCoordinator.addTab(url: url)
        }
        appState.prepareForBrowser()
        appState.prepareCameraAccess()
        showBrowser = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            appState.tabCoordinator.activeCoordinator?.load(urlString: url)
        }
    }
}