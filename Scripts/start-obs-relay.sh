#!/usr/bin/env bash
# OBS (Windows) → RTMP → MediaMTX (Linux VM) → HLS → SafariSpoofBrowser on iPhone
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
MTX="${BIN_DIR}/mediamtx"
CFG="${ROOT}/Scripts/mediamtx-obs.yml"
RTMP_PORT="${RTMP_PORT:-1935}"
HLS_PORT="${HLS_PORT:-8888}"
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

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$RTMP_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
  lsof -ti:"$HLS_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
fi

echo "Starting OBS relay (MediaMTX)..."
echo ""
echo "OBS → Settings → Stream:"
echo "  Service: Custom"
echo "  Server:  rtmp://${LAN_IP}:${RTMP_PORT}/live"
echo "  Key:     ${STREAM_NAME}"
echo ""
echo "iPhone → SafariSpoof → Settings → Network Stream → Apply URL:"
echo "  rtsp://${LAN_IP}:8554/live/${STREAM_NAME}   ← use this (low latency)"
echo "  http://${LAN_IP}:${HLS_PORT}/live/${STREAM_NAME}/index.m3u8  (fallback, high latency)"
echo ""
echo "Browser preview (Windows, after OBS is streaming):"
echo "  http://${LAN_IP}:${HLS_PORT}/live/${STREAM_NAME}/"
echo "  (do NOT open index.m3u8 directly — it downloads as a file)"
echo ""
echo "OBS scene: center face in frame. Output 1280x720 landscape → app crops to portrait 480x640."
echo ""
echo "VMware: Bridged recommended (iPhone must see ${LAN_IP})."
echo "Press Ctrl+C to stop."
echo ""

exec "$MTX" "$CFG"