#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INJECTION="$ROOT/SafariSpoofBrowser/Resources/injection"
OUT="$ROOT/SafariSpoofBrowser/Resources/injection/bundle.js"

MODULES=(
  "fingerprint/navigator.js"
  "fingerprint/screen.js"
  "fingerprint/webgl.js"
  "fingerprint/canvas.js"
  "fingerprint/audio.js"
  "media/frameReceiver.js"
  "media/mediaStreamMock.js"
  "media/getUserMedia.js"
  "webrtc/enumerateDevices.js"
)

echo "// Auto-generated injection bundle" > "$OUT"
for mod in "${MODULES[@]}"; do
  echo "" >> "$OUT"
  echo "// --- $mod ---" >> "$OUT"
  cat "$INJECTION/$mod" >> "$OUT"
done

echo "Bundled to $OUT"