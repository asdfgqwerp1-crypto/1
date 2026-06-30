import WebKit

@MainActor
final class TabDataStoreRegistry {
    private var stores: [UUID: WKWebsiteDataStore] = [:]
    private var pending: Set<UUID> = []

    func dataStore(for id: UUID, ephemeral: Bool, completion: @escaping (WKWebsiteDataStore) -> Void) {
        if ephemeral {
            completion(.nonPersistent())
            return
        }

        if let existing = stores[id] {
            completion(existing)
            return
        }

        if pending.contains(id) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                self?.dataStore(for: id, ephemeral: ephemeral, completion: completion)
            }
            return
        }

        if #available(iOS 17.0, *) {
            pending.insert(id)
            WKWebsiteDataStore(forIdentifier: id) { [weak self] store in
                Task { @MainActor in
                    self?.pending.remove(id)
                    self?.stores[id] = store
                    completion(store)
                }
            }
        } else {
            let store = WKWebsiteDataStore.default()
            stores[id] = store
            completion(store)
        }
    }

    func removeDataStore(id: UUID) {
        stores.removeValue(forKey: id)
        if #available(iOS 17.0, *) {
            WKWebsiteDataStore.remove(forIdentifier: id) {}
        }
    }

    func clearWebsiteData(for id: UUID, completion: @escaping () -> Void) {
        dataStore(for: id, ephemeral: false) { store in
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            store.fetchDataRecords(ofTypes: types) { records in
                store.removeData(ofTypes: types, for: records) {
                    DispatchQueue.main.async { completion() }
                }
            }
        }
    }
}