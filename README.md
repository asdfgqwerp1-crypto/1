# SafariSpoofBrowser

Standalone iOS anti-detect browser with realtime camera spoofing. Mimics Safari fingerprint and intercepts `getUserMedia` to inject a synthetic video stream.

## Requirements

- macOS with Xcode 15+
- iPhone (iOS 16+) for camera and fingerprint testing
- Apple Developer account for device deployment

## Quick Start

1. Open `SafariSpoofBrowser/SafariSpoofBrowser.xcodeproj` in Xcode
2. Set your Development Team in Signing & Capabilities
3. Connect iPhone, select as run destination
4. Build and Run (⌘R)

## Test Pages

```bash
cd TestPages
python3 -m http.server 8080
```

On iPhone, open `http://<your-mac-ip>:8080/fingerprint-diff/` in Safari (baseline) and SafariSpoofBrowser (spoof).

Compare reports:

```bash
./Scripts/diff-runner.sh docs/safari-diff-baseline/iphone15pro.json spoof-report.json
```

## Project Structure

See [agents.md](agents.md) for full agent development guide.

## Key Features (v1)

- WKWebView browser with persistent session
- Device fingerprint profiles (JSON)
- JS injection: navigator, screen, WebGL, canvas, audio
- Native video pipeline → frame bridge → canvas captureStream
- getUserMedia / enumerateDevices / getSettings spoofing
- HLS/HTTP network video ingest for external pipelines
- Local test suite + Safari diff runner