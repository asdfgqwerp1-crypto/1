import SwiftUI
import UIKit

struct DebugOverlayView: View {
    @ObservedObject var store: DebugLogStore
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("Debug Console")
                    .font(.caption.weight(.semibold))
                Spacer()
                Button("Copy") { copyLogs() }
                    .font(.caption.weight(.semibold))
                Button("Clear") { store.clear() }
                    .font(.caption.weight(.semibold))
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.85))

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        if store.entries.isEmpty {
                            Text("Нет логов. Откройте страницу — console.error и JS-ошибки появятся здесь.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .padding(.vertical, 8)
                        } else {
                            ForEach(store.entries) { entry in
                                Text(line(for: entry))
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundStyle(color(for: entry.level))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .id(entry.id)
                            }
                        }
                    }
                    .padding(8)
                }
                .onChange(of: store.entries.count) { _ in
                    if let last = store.entries.last?.id {
                        proxy.scrollTo(last, anchor: .bottom)
                    }
                }
            }
            .frame(maxHeight: 220)
            .background(Color(white: 0.08))
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.white.opacity(0.15), lineWidth: 1)
        )
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
    }

    private func line(for entry: DebugLogStore.Entry) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return "[\(formatter.string(from: entry.date))] \(entry.level): \(entry.message)"
    }

    private func color(for level: String) -> Color {
        switch level.lowercased() {
        case "error", "fatal":
            return Color(red: 1, green: 0.45, blue: 0.45)
        case "warn", "warning":
            return Color(red: 1, green: 0.82, blue: 0.4)
        default:
            return Color(white: 0.88)
        }
    }

    private func copyLogs() {
        UIPasteboard.general.string = store.exportText()
    }
}