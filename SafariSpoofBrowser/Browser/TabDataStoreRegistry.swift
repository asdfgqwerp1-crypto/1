import WebKit

final class TabDataStoreRegistry {
    private var stores: [UUID: WKWebsiteDataStore] = [:]
    private var pending: Set<UUID> = []
    private let lock = NSLock()

    func dataStore(for id: UUID, ephemeral: Bool, completion: @escaping (WKWebsiteDataStore) -> Void) {
        if ephemeral {
            DispatchQueue.main.async {
                completion(.nonPersistent())
            }
            return
        }

        lock.lock()
        if let existing = stores[id] {
            lock.unlock()
            DispatchQueue.main.async { completion(existing) }
            return
        }
        if pending.contains(id) {
            lock.unlock()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                self?.dataStore(for: id, ephemeral: ephemeral, completion: completion)
            }
            return
        }
        pending.insert(id)
        lock.unlock()

        if #available(iOS 17.0, *) {
            Task {
                let store = await WKWebsiteDataStore.dataStore(forIdentifier: id)
                lock.lock()
                pending.remove(id)
                stores[id] = store
                lock.unlock()
                DispatchQueue.main.async { completion(store) }
            }
        } else {
            lock.lock()
            let store = WKWebsiteDataStore.default()
            stores[id] = store
            pending.remove(id)
            lock.unlock()
            DispatchQueue.main.async { completion(store) }
        }
    }

    func removeDataStore(id: UUID) {
        lock.lock()
        stores.removeValue(forKey: id)
        lock.unlock()
        if #available(iOS 17.0, *) {
            Task {
                await WKWebsiteDataStore.removeDataStore(forIdentifier: id)
            }
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