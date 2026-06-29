import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var browserCoordinator = BrowserCoordinator()
    @State private var showBrowser = false
    @State private var addressText = ""

    var body: some View {
        HomeView(onOpenURL: openBrowser)
            .preferredColorScheme(.light)
            .fullScreenCover(isPresented: $showBrowser, onDismiss: {
                appState.stopVideoPipeline()
            }) {
                BrowserScreenView(
                    coordinator: browserCoordinator,
                    addressText: $addressText,
                    onClose: { showBrowser = false },
                    onNavigate: { url in
                        addressText = url
                        browserCoordinator.load(urlString: url)
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
        showBrowser = true
    }
}