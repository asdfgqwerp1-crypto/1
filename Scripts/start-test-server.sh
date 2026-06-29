#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../TestPages"
PORT="${1:-8080}"

echo ""
echo " Test server starting from:"
echo " $(pwd)"
echo ""
echo " Open on iPhone (same Wi-Fi):"
echo "   http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_PC_IP'):${PORT}/"
echo "   http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_PC_IP'):${PORT}/fingerprint-diff/"
echo ""

python3 -m http.server "$PORT"