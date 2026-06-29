import SwiftUI
import AVFoundation

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var networkURL = ""

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

                Section("Video Source") {
                    Picker("Source", selection: $appState.videoSource) {
                        Text("Front Camera").tag(VideoSourceType.deviceCamera(position: .front))
                        Text("Back Camera").tag(VideoSourceType.deviceCamera(position: .back))
                        Text("Network Stream").tag(VideoSourceType.network)
                    }
                    .onChange(of: appState.videoSource) { _ in
                        appState.stopVideoPipeline()
                        appState.startVideoPipeline()
                    }

                    if case .network = appState.videoSource {
                        TextField("HLS / HTTP video URL", text: $networkURL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Apply URL") {
                            appState.videoSource = .networkStream(url: networkURL)
                            appState.stopVideoPipeline()
                            appState.startVideoPipeline()
                        }
                    }
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
                }
            }
            .navigationTitle("Settings")
            .navigationBarItems(trailing: Button("Done") { dismiss() })
        }
    }
}

struct VideoPreviewView: UIViewRepresentable {
    let pipeline: VideoPipeline

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .black
        pipeline.attachPreview(to: view)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}