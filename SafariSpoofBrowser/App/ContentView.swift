import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var browserCoordinator = BrowserCoordinator()
    @State private var addressText = "https://www.apple.com"

    var body: some View {
        VStack(spacing: 0) {
            statusBar
            toolbar
            BrowserView(coordinator: browserCoordinator)
                .onAppear {
                    browserCoordinator.configure(
                        profile: appState.activeProfile,
                        frameBridge: appState.frameBridge
                    )
                    appState.startVideoPipeline()
                }
                .onDisappear {
                    appState.stopVideoPipeline()
                }
                .onChange(of: appState.activeProfile.id) { _, _ in
                    browserCoordinator.configure(
                        profile: appState.activeProfile,
                        frameBridge: appState.frameBridge
                    )
                }
        }
        .sheet(isPresented: $appState.showSettings) {
            SettingsView()
                .environmentObject(appState)
        }
    }

    private var statusBar: some View {
        HStack(spacing: 12) {
            Text(appState.activeProfile.displayName)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            if appState.bridgeMetrics.fps > 0 {
                Text(String(format: "%.0f fps", appState.bridgeMetrics.fps))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.green)
            }
            if appState.bridgeMetrics.latencyMs > 0 {
                Text(String(format: "%.0f ms", appState.bridgeMetrics.latencyMs))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.systemGroupedBackground))
        .onReceive(appState.frameBridge.metricsPublisher) { metrics in
            appState.bridgeMetrics = metrics
        }
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            Button { browserCoordinator.goBack() } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(!browserCoordinator.canGoBack)

            Button { browserCoordinator.goForward() } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(!browserCoordinator.canGoForward)

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
        .background(Color(.secondarySystemBackground))
    }
}