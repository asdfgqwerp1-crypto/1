import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @Binding var testServerURL: String
    let onOpenBrowser: () -> Void

    @State private var reachabilityStatus = "Нажмите «Проверить сервер»"
    @State private var isChecking = false

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()

            VStack(spacing: 18) {
                Text("SafariSpoof")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.black)

                Text(BuildInfo.marker)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.orange)

                VStack(spacing: 6) {
                    Text(appState.activeProfile.displayName)
                        .font(.headline)
                        .foregroundStyle(.black)
                    Text(appState.activeProfile.id)
                        .font(.caption.monospaced())
                        .foregroundStyle(.gray)
                    Text("Профилей: \(appState.profileStore.profiles.count)")
                        .font(.caption)
                        .foregroundStyle(.gray)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("URL тест-сервера (IP Linux VM):")
                        .font(.caption)
                        .foregroundStyle(.gray)
                    TextField("https://192.168.2.113:8443/webrtc-inspector/", text: $testServerURL)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)

                    HStack(spacing: 8) {
                        Button("HTTP тест") {
                            testServerURL = "http://192.168.2.113:8080/fingerprint-diff/"
                        }
                        .font(.caption)
                        Button("HTTPS камера") {
                            testServerURL = "https://192.168.2.113:8443/webrtc-inspector/"
                        }
                        .font(.caption)
                    }

                    Button {
                        isChecking = true
                        Task {
                            reachabilityStatus = await ServerReachability.check(urlString: testServerURL)
                            isChecking = false
                        }
                    } label: {
                        Text(isChecking ? "Проверка…" : "Проверить сервер")
                            .font(.caption.weight(.semibold))
                    }
                    .disabled(isChecking)

                    Text(reachabilityStatus)
                        .font(.caption)
                        .foregroundStyle(reachabilityStatus.contains("OK") ? .green : .red)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 24)

                Button(action: onOpenBrowser) {
                    Text("Открыть браузер")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.blue)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 24)

                Button { appState.showSettings = true } label: {
                    Text("Настройки")
                        .font(.headline)
                        .foregroundStyle(.blue)
                }
            }
            .padding(.vertical, 32)
        }
    }
}