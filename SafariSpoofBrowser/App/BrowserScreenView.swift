import SwiftUI

struct BrowserScreenView: View {
    @EnvironmentObject private var appState: AppState
    @ObservedObject var tabCoordinator: TabCoordinator
    @Binding var addressText: String
    let onClose: () -> Void
    let onNavigate: (String) -> Void

    @State private var showDebugPanel = false
    @ObservedObject private var debugLogStore = DebugLogStore.shared
    @ObservedObject private var mediaStatus = MediaDeliveryStatusStore.shared

    private var activeCoordinator: BrowserCoordinator {
        tabCoordinator.coordinator(for: tabCoordinator.activeTabID)
    }

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            statusBar
            tabBar
            bookmarkBar
            navigationBar
            webViews
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
            tabCoordinator.tabs.forEach { tab in
                let coordinator = tabCoordinator.coordinator(for: tab.id)
                coordinator.refreshInjection()
                if tab.id == tabCoordinator.activeTabID {
                    coordinator.reload()
                }
            }
        }
        .onChange(of: appState.activeProfile.id) { _ in
            let profile = appState.effectiveProfile
            tabCoordinator.tabs.forEach { tab in
                tabCoordinator.coordinator(for: tab.id).configure(
                    profile: profile,
                    frameBridge: appState.frameBridge
                )
            }
        }
        .onChange(of: tabCoordinator.activeTabID) { _ in
            syncAddressFromActiveTab()
        }
        .onAppear {
            syncAddressFromActiveTab()
            tabCoordinator.persistNow()
        }
        .onDisappear {
            tabCoordinator.persistNow()
        }
    }

    private var headerBar: some View {
        HStack(spacing: 8) {
            Button(action: onClose) {
                Label("Домой", systemImage: "house.fill")
                    .font(.caption.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)

            Text(BuildInfo.marker)
                .font(.caption2.monospaced())
                .foregroundStyle(.white.opacity(0.9))

            Text("\(tabCoordinator.tabs.count) вкл.")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.85))

            Spacer()

            if activeCoordinator.isLoading {
                ProgressView()
                    .tint(.white)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.blue)
    }

    private var statusBar: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(activeCoordinator.statusMessage)
                    .foregroundStyle(
                        activeCoordinator.statusMessage.contains("Ошибка")
                            || activeCoordinator.statusMessage.contains("Не открылось")
                            ? .red : .secondary
                    )
                Spacer(minLength: 8)
                Text(String(format: "%.0f fps · %d frm", appState.bridgeMetrics.fps, appState.bridgeMetrics.framesSent))
                    .font(.caption2.monospaced())
                    .foregroundStyle(appState.bridgeMetrics.framesSent > 0 ? .green : .orange)
            }
            Text(mediaStatus.statusLine)
                .font(.caption2.monospaced())
                .foregroundStyle(mediaStatus.hasNativeMismatch ? .orange : .secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .font(.caption)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(white: 0.96))
    }

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(tabCoordinator.tabs) { tab in
                    tabChip(tab)
                }
                Button {
                    let tab = tabCoordinator.addTab()
                    addressText = tab.url
                } label: {
                    Image(systemName: "plus")
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                        .background(Color.blue.opacity(0.12))
                        .foregroundStyle(.blue)
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .background(Color(white: 0.98))
    }

    private func tabChip(_ tab: TabSession) -> some View {
        let isActive = tab.id == tabCoordinator.activeTabID
        return HStack(spacing: 6) {
            Button {
                tabCoordinator.selectTab(tab.id)
                addressText = tab.url
            } label: {
                HStack(spacing: 4) {
                    if tab.isEphemeral {
                        Image(systemName: "eye.slash.fill")
                            .font(.caption2)
                    }
                    Text(tab.displayTitle)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(isActive ? Color.blue : Color.blue.opacity(0.12))
                .foregroundStyle(isActive ? .white : .blue)
                .clipShape(Capsule())
            }

            if tabCoordinator.tabs.count > 1 {
                Button {
                    tabCoordinator.closeTab(tab.id)
                    syncAddressFromActiveTab()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(isActive ? .white.opacity(0.9) : .secondary)
                }
            }
        }
        .contextMenu {
            Button("Очистить cookies/storage") {
                tabCoordinator.clearTabData(tab.id)
            }
            Button("Приватная вкладка") {
                let tab = tabCoordinator.addTab(ephemeral: true)
                addressText = tab.url
            }
        }
    }

    private var bookmarkBar: some View {
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
    }

    private var navigationBar: some View {
        HStack(spacing: 8) {
            Button { activeCoordinator.goBack() } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(!activeCoordinator.canGoBack)

            Button { activeCoordinator.reload() } label: {
                Image(systemName: "arrow.clockwise")
            }

            TextField("URL", text: $addressText)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .onSubmit { activeCoordinator.load(urlString: addressText) }

            Button { activeCoordinator.load(urlString: addressText) } label: {
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
    }

    private var webViews: some View {
        ZStack {
            ForEach(tabCoordinator.tabs) { tab in
                BrowserView(
                    coordinator: tabCoordinator.coordinator(for: tab.id),
                    tab: tab,
                    profile: appState.effectiveProfile,
                    frameBridge: appState.frameBridge,
                    dataStoreRegistry: tabCoordinator.dataStoreRegistry,
                    isActive: tab.id == tabCoordinator.activeTabID
                )
                .opacity(tab.id == tabCoordinator.activeTabID ? 1 : 0)
                .allowsHitTesting(tab.id == tabCoordinator.activeTabID)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
    }

    private func syncAddressFromActiveTab() {
        if let tab = tabCoordinator.activeTab, !tab.url.isEmpty {
            addressText = tab.url
        }
    }
}