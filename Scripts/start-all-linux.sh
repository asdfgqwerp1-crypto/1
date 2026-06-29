#!/usr/bin/env bash
# Запуск тест-серверов на Linux VM (HTTP + HTTPS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HTTP_PORT="${1:-8080}"
HTTPS_PORT="${2:-8443}"

kill_port() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$p" 2>/dev/null | xargs -r kill 2>/dev/null || true
  fi
}

kill_port "$HTTP_PORT"
kill_port "$HTTPS_PORT"

IP=$(python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(('8.8.8.8', 80))
print(s.getsockname()[0])
s.close()
" 2>/dev/null || echo "UNKNOWN")

echo ""
echo "========================================"
echo " SafariSpoof Test Servers (Linux VM)"
echo "========================================"
echo ""
echo " VM IP: $IP"
echo ""
echo " Fingerprint (HTTP):"
echo "   http://$IP:$HTTP_PORT/fingerprint-diff/"
echo ""
echo " Camera / WebRTC (HTTPS):"
echo "   https://$IP:$HTTPS_PORT/webrtc-inspector/"
echo ""
echo " iPhone и VM должны быть в одной сети!"
echo " VMware: Network Adapter -> Bridged"
echo ""
echo " Остановить: kill_port или Ctrl+C в логах"
echo "========================================"
echo ""

# HTTP в фоне
nohup python3 -m http.server "$HTTP_PORT" --directory "$ROOT/TestPages" \
  > /tmp/safarispoof-http.log 2>&1 &
echo "HTTP  PID $!  log: /tmp/safarispoof-http.log"

# HTTPS в фоне
nohup python3 "$ROOT/Scripts/start-test-server-https.py" "$HTTPS_PORT" \
  > /tmp/safarispoof-https.log 2>&1 &
echo "HTTPS PID $!  log: /tmp/safarispoof-https.log"

sleep 1
echo ""
echo "Проверка:"
curl -s -o /dev/null -w "  HTTP  fingerprint-diff: %{http_code}\n" "http://127.0.0.1:$HTTP_PORT/fingerprint-diff/" || true
curl -sk -o /dev/null -w "  HTTPS webrtc-inspector: %{http_code}\n" "https://127.0.0.1:$HTTPS_PORT/webrtc-inspector/" || true
echo ""
echo "----------------------------------------"
echo " OK: серверы работают В ФОНЕ."
echo " Скрипт завершился — это нормально."
echo ""
echo " Проверить:  ./Scripts/status-test-servers.sh"
echo " Остановить: ./Scripts/stop-test-servers.sh"
echo ""
echo " Чтобы окно не закрывалось (GUI / двойной клик):"
echo "   ./Scripts/start-all-linux-foreground.sh"
echo "----------------------------------------"