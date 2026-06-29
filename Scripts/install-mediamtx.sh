#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
VERSION="${MEDIAMTX_VERSION:-v1.19.2}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) PLATFORM="linux_amd64" ;;
  aarch64|arm64) PLATFORM="linux_arm64" ;;
  armv7l) PLATFORM="linux_armv7" ;;
  armv6l) PLATFORM="linux_armv6" ;;
  *)
    echo "Unsupported arch: $ARCH"
    exit 1
    ;;
esac

ASSET="mediamtx_${VERSION}_${PLATFORM}.tar.gz"
URL="https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/${ASSET}"

mkdir -p "$BIN_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL ..."
curl -fsSL -o "$TMP/$ASSET" "$URL"
tar -xzf "$TMP/$ASSET" -C "$TMP"
install -m 0755 "$TMP/mediamtx" "$BIN_DIR/mediamtx"

echo "OK — installed $BIN_DIR/mediamtx ($VERSION $PLATFORM)"
"$BIN_DIR/mediamtx --version" 2>/dev/null || "$BIN_DIR/mediamtx" --help | head -1