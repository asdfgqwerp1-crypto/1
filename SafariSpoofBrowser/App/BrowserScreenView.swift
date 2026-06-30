import SwiftUI

struct BrowserScreenView: View {
    @EnvironmentObject private var appState: AppState
    @ObservedObject var coordinator: BrowserCoordinator
    @Binding var addressText: String
    let onClose: () -> Void
    let onNavigate: (String) -> Void

    @State private var mountWebView = true
    @State private var showDebugPanel = false
    @ObservedObject private var debugLogStore = DebugLogStore.shared

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button(action: onClose) {
                    Label("Домой", systemImage: "house.fill")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)

                Text(BuildInfo.marker)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.white.opacity(0.9))

                Spacer()

                if coordinator.isLoading {
                    ProgressView()
                        .tint(.white)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.blue)

            HStack(spacing: 8) {
                Text(coordinator.statusMessage)
                    .foregroundStyle(coordinator.statusMessage.contains("Ошибка") || coordinator.statusMessage.contains("Не открылось") ? .red : .secondary)
                Spacer(minLength: 8)
                Text(String(format: "%.0f fps · %d frm", appState.bridgeMetrics.fps, appState.bridgeMetrics.framesSent))
                    .font(.caption2.monospaced())
                    .foregroundStyle(appState.bridgeMetrics.framesSent > 0 ? .green : .orange)
            }
            .font(.caption)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(white: 0.96))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(TestBookmark.all) { bookmark in
                        Button(bookmark.title) {
                            onNavigate(bookmark.url(host: appState.testServerHost))
                        }
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.12))
                        .foregroundStyle(.blue)
                        .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
            .background(Color.white)

            HStack(spacing: 8) {
                Button { coordinator.goBack() } label: {
                    Image(systemName: "chevron.left")
                }
                .disabled(!coordinator.canGoBack)

                Button { coordinator.reload() } label: {
                    Image(systemName: "arrow.clockwise")
                }

                TextField("URL", text: $addressText)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .onSubmit { coordinator.load(urlString: addressText) }

                Button { coordinator.load(urlString: addressText) } label: {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundStyle(.blue)
                }

                Button {
                    showDebugPanel.toggle()
                } label: {
                    Image(systemName: showDebugPanel ? "ladybug.fill" : "ladybug")
                        .foregroundStyle(.orange)
                }

                Button { appState.showSettings = true } label: {
                    Image(systemName: "gearshape")
                }
            }
            .padding(8)
            .background(Color.white)

            if mountWebView {
                BrowserView(
                    coordinator: coordinator,
                    profile: appState.effectiveProfile,
                    frameBridge: appState.frameBridge,
                    initialURL: addressText
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.white)
            }
        }
        .background(Color.white)
        .overlay(alignment: .bottom) {
            if showDebugPanel {
                DebugOverlayView(
                    store: debugLogStore,
                    captureEnabled: DebugSettings.consoleEnabled
                ) {
                    showDebugPanel = false
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .debugConsoleSettingsChanged)) { _ in
            if DebugSettings.consoleEnabled {
                showDebugPanel = true
            } else {
                showDebugPanel = false
                debugLogStore.clear()
            }
            coordinator.refreshInjection()
            coordinator.reload()
        }
        .onChange(of: appState.activeProfile.id) { _ in
            coordinator.configure(
                profile: appState.effectiveProfile,
                frameBridge: appState.frameBridge
            )
        }

    }
}