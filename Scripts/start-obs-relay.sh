#!/usr/bin/env bash
# OBS (Windows) → RTMP → MediaMTX (Linux VM) → HTTP JPEG → SafariSpoofBrowser on iPhone
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
export PATH="$BIN_DIR:$PATH"
MTX="${BIN_DIR}/mediamtx"
CFG="${ROOT}/Scripts/mediamtx-obs.yml"
RELAY_PY="${ROOT}/Scripts/frame-http-relay.py"
RTMP_PORT="${RTMP_PORT:-1935}"
HLS_PORT="${HLS_PORT:-8888}"
FRAME_PORT="${FRAME_PORT:-8090}"
STREAM_NAME="${STREAM_NAME:-obs}"

if ! command -v ip >/dev/null 2>&1; then
  echo "ip command not found"
  exit 1
fi

LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')"
LAN_IP="${LAN_IP:-127.0.0.1}"

if [ ! -x "$MTX" ]; then
  echo "MediaMTX not found. Run: ./Scripts/install-mediamtx.sh"
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found — installing to $BIN_DIR ..."
  "$ROOT/Scripts/install-ffmpeg.sh"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 required"
  exit 1
fi

chmod +x "$RELAY_PY"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$RTMP_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
  lsof -ti:"$HLS_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
  lsof -ti:"$FRAME_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
fi

cleanup() {
  kill "$FRAME_PID" "$MTX_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting OBS relay (MediaMTX + HTTP frame relay)..."
echo ""
echo "OBS → Settings → Stream:"
echo "  Service: Custom"
echo "  Server:  rtmp://${LAN_IP}:${RTMP_PORT}/live"
echo "  Key:     ${STREAM_NAME}"
echo ""
echo "iPhone → SafariSpoof → Settings → Network Stream → Apply URL:"
echo "  http://${LAN_IP}:${FRAME_PORT}/frame.jpg   ← low latency (~100-300 ms)"
echo "  (HLS/RTSP URLs also work — app auto-uses frame.jpg on port ${FRAME_PORT})"
echo ""
echo "Browser preview (Windows, after OBS is streaming):"
echo "  http://${LAN_IP}:${HLS_PORT}/live/${STREAM_NAME}/"
echo ""
echo "Test frame relay:"
echo "  curl -sI http://${LAN_IP}:${FRAME_PORT}/frame.jpg"
echo ""
echo "VMware: Bridged recommended (iPhone must see ${LAN_IP})."
echo "Press Ctrl+C to stop."
echo ""

"$MTX" "$CFG" &
MTX_PID=$!
sleep 2

python3 "$RELAY_PY" \
  --rtsp "rtsp://127.0.0.1:8554/live/${STREAM_NAME}" \
  --port "$FRAME_PORT" \
  --width 1280 \
  --height 720 \
  --fps 30 &
FRAME_PID=$!

wait "$MTX_PID"