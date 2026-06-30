import WebKit

final class TabDataStoreRegistry {
    @MainActor private var stores: [UUID: WKWebsiteDataStore] = [:]

    func dataStore(for id: UUID, ephemeral: Bool, completion: @escaping (WKWebsiteDataStore) -> Void) {
        Task { @MainActor in
            if ephemeral {
                completion(.nonPersistent())
                return
            }
            if let existing = stores[id] {
                completion(existing)
                return
            }
            let store: WKWebsiteDataStore
            if #available(iOS 17.0, *) {
                store = WKWebsiteDataStore(forIdentifier: id)
            } else {
                store = .default()
            }
            stores[id] = store
            completion(store)
        }
    }

    func removeDataStore(id: UUID) {
        Task { @MainActor in
            stores.removeValue(forKey: id)
            guard #available(iOS 17.0, *) else { return }
            try? await WKWebsiteDataStore.remove(forIdentifier: id)
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