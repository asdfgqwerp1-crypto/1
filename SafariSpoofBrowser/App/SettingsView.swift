import SwiftUI
import AVFoundation

private enum SourcePickerChoice: Hashable {
    case front, back, network
}

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var networkURL = ""
    @State private var cameraAccessDenied = false

    private var sourcePickerValue: SourcePickerChoice {
        switch appState.videoSource {
        case .deviceCamera(let position) where position == .back:
            return .back
        case .networkStream, .network:
            return .network
        default:
            return .front
        }
    }

    private func applySourcePicker(_ choice: SourcePickerChoice) {
        switch choice {
        case .front:
            appState.videoSource = .deviceCamera(position: .front)
        case .back:
            appState.videoSource = .deviceCamera(position: .back)
        case .network:
            let url = networkURL.isEmpty
                ? (NetworkStreamSettings.url ?? "http://\(TestServerSettings.host):8090/frame.jpg")
                : networkURL
            networkURL = url
            NetworkStreamSettings.url = url
            appState.videoSource = .networkStream(url: url)
        }
        appState.stopVideoPipeline()
        appState.startVideoPipeline()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Device Profile") {
                    Picker("Profile", selection: Binding(
                        get: { appState.activeProfile.id },
                        set: { id in
                            if let profile = appState.profileStore.profile(id: id) {
                                appState.selectProfile(profile)
                            }
                        }
                    )) {
                        ForEach(appState.profileStore.profiles) { profile in
                            Text(profile.displayName).tag(profile.id)
                        }
                    }
                }

                Section("Frame Delivery") {
                    LabeledContent("Format", value: "JPEG")
                    Text("JPEG + VFR ~30 fps. Размер из constraints сайта или mediaDefaults по facingMode.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Video Source") {
                    Picker("Source", selection: Binding(
                        get: { sourcePickerValue },
                        set: { applySourcePicker($0) }
                    )) {
                        Text("Front Camera").tag(SourcePickerChoice.front)
                        Text("Back Camera").tag(SourcePickerChoice.back)
                        Text("Network Stream").tag(SourcePickerChoice.network)
                    }

                    if appState.usesNetworkVideoSource {
                        TextField("http://IP:8090/frame.jpg (low latency)", text: $networkURL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Apply URL") {
                            NetworkStreamSettings.url = networkURL
                            appState.videoSource = .networkStream(url: networkURL)
                            appState.stopVideoPipeline()
                            appState.startVideoPipeline()
                        }
                        Text("Превью чёрное = OBS relay не запущен или неверный IP. Запустите ./Scripts/start-obs-relay.sh")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Debug") {
                    Toggle("JS Log Capture", isOn: Binding(
                        get: { DebugSettings.consoleEnabled },
                        set: { enabled in
                            DebugSettings.consoleEnabled = enabled
                            NotificationCenter.default.post(name: .debugConsoleSettingsChanged, object: nil)
                        }
                    ))
                    Text("Кнопка 🐞 в браузере всегда видна. Этот переключатель добавляет перехват console.error/onerror. gUM-трасса пишется всегда.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Bridge Metrics") {
                    LabeledContent("FPS", value: String(format: "%.1f", appState.bridgeMetrics.fps))
                    LabeledContent("Latency", value: String(format: "%.1f ms", appState.bridgeMetrics.latencyMs))
                    LabeledContent("Frames sent", value: "\(appState.bridgeMetrics.framesSent)")
                }

                Section("Preview") {
                    VideoPreviewView(pipeline: appState.videoPipeline)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    if cameraAccessDenied && !appState.usesNetworkVideoSource {
                        Text("Нет доступа к камере. Настройки → SafariSpoof → Камера → Вкл.")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarItems(trailing: Button("Done") { dismiss() })
            .onAppear {
                if let saved = NetworkStreamSettings.url, !saved.isEmpty {
                    networkURL = saved
                }
                Task {
                    if !appState.usesNetworkVideoSource {
                        let granted = await AppState.requestCameraPermission()
                        await MainActor.run {
                            cameraAccessDenied = !granted
                            if granted { appState.startVideoPipeline() }
                        }
                    } else {
                        appState.startVideoPipeline()
                    }
                }
            }
            .onDisappear {
                if !appState.usesNetworkVideoSource {
                    appState.stopVideoPipeline()
                }
            }
        }
    }
}

final class PreviewHostView: UIView {
    var pipeline: VideoPipeline?

    override func layoutSubviews() {
        super.layoutSubviews()
        guard let pipeline else { return }
        pipeline.updatePreviewLayout(in: self)
    }
}

struct VideoPreviewView: UIViewRepresentable {
    let pipeline: VideoPipeline

    func makeUIView(context: Context) -> PreviewHostView {
        let view = PreviewHostView()
        view.backgroundColor = .black
        view.pipeline = pipeline
        pipeline.attachPreview(to: view)
        return view
    }

    func updateUIView(_ uiView: PreviewHostView, context: Context) {
        uiView.pipeline = pipeline
        pipeline.attachPreview(to: uiView)
    }
}