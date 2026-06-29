import Foundation

enum ServerReachability {
    static func check(urlString: String) async -> String {
        let normalized = URLNormalizer.normalize(urlString)
        guard let url = URL(string: normalized) else {
            return "Неверный URL"
        }

        var request = URLRequest(url: url, timeoutInterval: 5)
        request.httpMethod = "HEAD"

        let session = URLSession(configuration: .ephemeral, delegate: TrustLocalHTTPSDelegate.shared, delegateQueue: nil)

        do {
            let (_, response) = try await session.data(for: request)
            if let http = response as? HTTPURLResponse {
                return "Сервер OK (HTTP \(http.statusCode))"
            }
            return "Сервер ответил"
        } catch {
            if (error as NSError).code == NSURLErrorCannotConnectToHost {
                return "Сервер недоступен — запустите ./Scripts/start-all-linux.sh на VM"
            }
            if (error as NSError).code == NSURLErrorNotConnectedToInternet {
                return "Нет сети — iPhone и VM в одной Wi‑Fi?"
            }
            return "Ошибка: \(error.localizedDescription)"
        }
    }
}

private final class TrustLocalHTTPSDelegate: NSObject, URLSessionDelegate, URLSessionTaskDelegate {
    static let shared = TrustLocalHTTPSDelegate()

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let trust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: trust))
            return
        }
        completionHandler(.performDefaultHandling, nil)
    }
}