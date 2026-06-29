#!/usr/bin/env bash
# Static ffmpeg for user-space install (no sudo)
set -euo pipefail

BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) ASSET="ffmpeg-master-latest-linux64-gpl.tar.xz" ;;
  aarch64|arm64) ASSET="ffmpeg-master-latest-linuxarm64-gpl.tar.xz" ;;
  *)
    echo "Unsupported arch: $ARCH"
    exit 1
    ;;
esac

URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${ASSET}"
mkdir -p "$BIN_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL ..."
curl -fsSL -o "$TMP/$ASSET" "$URL"
tar -xJf "$TMP/$ASSET" -C "$TMP"
FFMPEG="$(find "$TMP" -name ffmpeg -type f | head -1)"
if [ -z "$FFMPEG" ]; then
  echo "ffmpeg binary not found in archive"
  exit 1
fi
install -m 0755 "$FFMPEG" "$BIN_DIR/ffmpeg"
echo "OK — installed $BIN_DIR/ffmpeg"
"$BIN_DIR/ffmpeg" -version | head -1