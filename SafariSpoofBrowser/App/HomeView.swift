import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    let onOpenURL: (String) -> Void

    @State private var reachabilityStatus = "Нажмите «Проверить сервер»"
    @State private var isChecking = false

    private var bookmarks: [TestBookmark] { TestBookmark.all }

    var body: some View {
        ScrollView {
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
                    Text("IP Linux VM (Wi‑Fi):")
                        .font(.caption)
                        .foregroundStyle(.gray)
                    TextField("192.168.2.113", text: $appState.testServerHost)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.decimalPad)
                        .onChange(of: appState.testServerHost) { value in
                            TestServerSettings.host = value
                        }

                    Button {
                        isChecking = true
                        let url = TestBookmark.all[1].url(host: appState.testServerHost)
                        Task {
                            reachabilityStatus = await ServerReachability.check(urlString: url)
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

                VStack(alignment: .leading, spacing: 10) {
                    Text("Быстрые тесты")
                        .font(.headline)
                        .foregroundStyle(.black)

                    ForEach(bookmarks) { bookmark in
                        Button {
                            onOpenURL(bookmark.url(host: appState.testServerHost))
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(bookmark.title)
                                        .font(.subheadline.weight(.semibold))
                                    Text(bookmark.url(host: appState.testServerHost))
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: "arrow.right.circle.fill")
                                    .foregroundStyle(.blue)
                            }
                            .padding(12)
                            .background(Color(white: 0.96))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 24)

                Button { appState.showSettings = true } label: {
                    Text("Настройки")
                        .font(.headline)
                        .foregroundStyle(.blue)
                }
                .padding(.bottom, 24)
            }
            .padding(.vertical, 24)
        }
        .background(Color.white)
    }
}