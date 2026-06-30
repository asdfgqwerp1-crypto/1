import Foundation
import Combine

@MainActor
final class TabCoordinator: ObservableObject {
    @Published private(set) var tabs: [TabSession] = []
    @Published var activeTabID: UUID
    @Published private(set) var coordinators: [UUID: BrowserCoordinator] = [:]

    let dataStoreRegistry = TabDataStoreRegistry()

    private var saveWorkItem: DispatchWorkItem?
    private let profileProvider: () -> DeviceProfile
    private let profileIDProvider: () -> String

    var activeTab: TabSession? {
        tabs.first { $0.id == activeTabID }
    }

    var activeCoordinator: BrowserCoordinator? {
        coordinators[activeTabID]
    }

    init(
        profileProvider: @escaping () -> DeviceProfile,
        profileIDProvider: @escaping () -> String
    ) {
        self.profileProvider = profileProvider
        self.profileIDProvider = profileIDProvider

        if let snapshot = BrowserSessionStore.load(), !snapshot.tabs.isEmpty {
            tabs = snapshot.tabs
            activeTabID = snapshot.activeTabID
        } else {
            let tab = TabSession(profileID: profileIDProvider())
            tabs = [tab]
            activeTabID = tab.id
        }

        tabs.forEach { ensureCoordinator(for: $0) }
        scheduleSave()
    }

    func coordinator(for tabID: UUID) -> BrowserCoordinator {
        if let existing = coordinators[tabID] { return existing }
        let tab = tabs.first { $0.id == tabID }
            ?? TabSession(profileID: profileIDProvider())
        ensureCoordinator(for: tab)
        return coordinators[tabID]!
    }

    func selectTab(_ id: UUID) {
        guard tabs.contains(where: { $0.id == id }) else { return }
        activeTabID = id
        scheduleSave()
    }

    @discardableResult
    func addTab(url: String = "", ephemeral: Bool = false) -> TabSession {
        let tab = TabSession(
            url: url,
            profileID: profileIDProvider(),
            isEphemeral: ephemeral
        )
        tabs.append(tab)
        activeTabID = tab.id
        ensureCoordinator(for: tab)
        scheduleSave()
        return tab
    }

    func closeTab(_ id: UUID) {
        guard tabs.count > 1 else { return }
        tabs.removeAll { $0.id == id }
        coordinators.removeValue(forKey: id)
        if !tabs.contains(where: { $0.id == activeTabID }) {
            activeTabID = tabs[0].id
        }
        dataStoreRegistry.removeDataStore(id: id)
        scheduleSave()
    }

    func updateTab(_ id: UUID, url: String?, title: String?) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        if let url, !url.isEmpty, !url.hasPrefix("about:") {
            tabs[index].url = url
        }
        if let title, !title.isEmpty {
            tabs[index].title = title
        }
        scheduleSave()
    }

    func clearTabData(_ id: UUID) {
        dataStoreRegistry.clearWebsiteData(for: id) { [weak self] in
            self?.coordinator(for: id).reload()
        }
    }

    func persistNow() {
        let snapshot = BrowserSnapshot(
            tabs: tabs,
            activeTabID: activeTabID,
            activeProfileID: profileIDProvider(),
            savedAt: Date()
        )
        BrowserSessionStore.save(snapshot)
        BrowserSessionSettings.activeProfileID = profileIDProvider()
    }

    private func ensureCoordinator(for tab: TabSession) {
        guard coordinators[tab.id] == nil else { return }
        let coordinator = BrowserCoordinator()
        coordinator.onPageUpdate = { [weak self] url, title in
            self?.updateTab(tab.id, url: url, title: title)
        }
        coordinators[tab.id] = coordinator
    }

    private func scheduleSave() {
        saveWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.persistNow()
        }
        saveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }
}