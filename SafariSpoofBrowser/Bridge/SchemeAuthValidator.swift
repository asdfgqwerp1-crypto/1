import Foundation

enum SchemeAuthValidator {
    private(set) static var authKey: String = ""

    static func setAuthKey(_ key: String) {
        authKey = key
    }

    static func isAuthorized(_ url: URL) -> Bool {
        guard !authKey.isEmpty else { return true }
        guard let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .first(where: { $0.name == "k" })?
            .value,
              value == authKey else {
            return false
        }
        return true
    }

    static var unauthorizedError: NSError {
        NSError(
            domain: NSURLErrorDomain,
            code: NSURLErrorCannotFindHost,
            userInfo: [NSLocalizedDescriptionKey: "A server with the specified hostname could not be found."]
        )
    }
}