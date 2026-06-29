import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    let onOpenBrowser: () -> Void

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()

            VStack(spacing: 20) {
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
                    Text("Профилей загружено: \(appState.profileStore.profiles.count)")
                        .font(.caption)
                        .foregroundStyle(.gray)
                }

                Text("Если видите этот экран — приложение работает.\nWebView откроется только по кнопке.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.black.opacity(0.7))
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
            .padding(.vertical, 40)
        }
    }
}