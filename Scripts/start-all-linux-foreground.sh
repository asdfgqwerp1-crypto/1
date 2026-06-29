#!/usr/bin/env bash
# Запуск серверов + терминал остаётся открытым (для запуска двойным кликом из GUI)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/Scripts/start-all-linux.sh" "$@"

HTTP_PID=$(lsof -ti:8080 2>/dev/null | head -1 || true)
HTTPS_PID=$(lsof -ti:8443 2>/dev/null | head -1 || true)

cleanup() {
  echo ""
  echo "Остановка серверов..."
  "$ROOT/Scripts/stop-test-servers.sh"
  exit 0
}
trap cleanup INT TERM

echo ""
echo "----------------------------------------"
echo " Серверы РАБОТАЮТ. Это окно не закрывайте"
echo " пока тестируете iPhone."
echo ""
echo " Ctrl+C — остановить серверы и выйти"
echo " Проверка: ./Scripts/status-test-servers.sh"
echo "----------------------------------------"
echo ""

tail -f /tmp/safarispoof-http.log /tmp/safarispoof-https.log 2>/dev/null || {
  echo "Логи: /tmp/safarispoof-http.log /tmp/safarispoof-https.log"
  echo "Ожидание... (Ctrl+C для остановки)"
  while true; do sleep 60; done
}