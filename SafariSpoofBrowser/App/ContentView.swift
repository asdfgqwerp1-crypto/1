import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var browserCoordinator = BrowserCoordinator()
    @State private var showBrowser = false
    @State private var addressText = "https://192.168.2.113:8443/webrtc-inspector/"

    var body: some View {
        HomeView(testServerURL: $addressText, onOpenBrowser: { showBrowser = true })
            .preferredColorScheme(.light)
            .fullScreenCover(isPresented: $showBrowser, onDismiss: {
                appState.stopVideoPipeline()
            }) {
                BrowserScreenView(
                    coordinator: browserCoordinator,
                    addressText: $addressText,
                    onClose: { showBrowser = false }
                )
                .environmentObject(appState)
            }
            .sheet(isPresented: $appState.showSettings) {
                SettingsView()
                    .environmentObject(appState)
            }
    }
}