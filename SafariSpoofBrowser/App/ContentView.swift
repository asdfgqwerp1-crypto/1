import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var browserCoordinator = BrowserCoordinator()
    @State private var showBrowser = false
    @State private var mountWebView = false
    @State private var addressText = ""

    var body: some View {
        Group {
            if showBrowser {
                browserScreen
            } else {
                HomeView(onOpenBrowser: openBrowser)
            }
        }
        .preferredColorScheme(.light)
        .sheet(isPresented: $appState.showSettings) {
            SettingsView()
                .environmentObject(appState)
        }
    }

    private func openBrowser() {
        if addressText.isEmpty {
            addressText = "https://192.168.2.113:8443/webrtc-inspector/"
        }
        showBrowser = true
        mountWebView = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            mountWebView = true
            browserCoordinator.load(urlString: addressText)
        }
    }

    private var browserScreen: some View {
        VStack(spacing: 0) {
            statusBar
            browserToolbar

            if mountWebView {
                BrowserView(
                    coordinator: browserCoordinator,
                    profile: appState.activeProfile,
                    frameBridge: appState.frameBridge
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.white)
            } else {
                ZStack {
                    Color.white
                    ProgressView("Загрузка браузера…")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color.white)
        .onDisappear {
            appState.stopVideoPipeline()
        }
        .onChange(of: appState.activeProfile.id) { _ in
            browserCoordinator.configure(
                profile: appState.activeProfile,
                frameBridge: appState.frameBridge
            )
        }
    }

    private var statusBar: some View {
        HStack(spacing: 8) {
            Button {
                showBrowser = false
                mountWebView = false
                appState.stopVideoPipeline()
            } label: {
                Image(systemName: "house.fill")
                    .foregroundStyle(.blue)
            }

            Text(BuildInfo.marker)
                .font(.caption2.monospaced())
                .foregroundStyle(.orange)

            Text(appState.activeProfile.id)
                .font(.caption2.monospaced())
                .lineLimit(1)
                .foregroundStyle(.secondary)

            Spacer()

            if appState.bridgeMetrics.fps > 0 {
                Text(String(format: "%.0f fps", appState.bridgeMetrics.fps))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.green)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(white: 0.95))
        .onReceive(appState.frameBridge.metricsPublisher) { metrics in
            appState.bridgeMetrics = metrics
        }
    }

    private var browserToolbar: some View {
        HStack(spacing: 8) {
            Button { browserCoordinator.goBack() } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(!browserCoordinator.canGoBack)

            Button { browserCoordinator.reload() } label: {
                Image(systemName: "arrow.clockwise")
            }

            TextField("URL", text: $addressText)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .onSubmit { browserCoordinator.load(urlString: addressText) }

            Button { browserCoordinator.load(urlString: addressText) } label: {
                Image(systemName: "arrow.right.circle.fill")
            }

            Button { appState.showSettings = true } label: {
                Image(systemName: "gearshape")
            }
        }
        .padding(8)
        .background(Color(white: 0.9))
    }
}