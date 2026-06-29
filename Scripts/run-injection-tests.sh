#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8090}"
LOG="/tmp/safarispoof-injection-test.log"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
fi

if command -v npm >/dev/null 2>&1; then
  cd "$ROOT/Scripts"
  if [ ! -d node_modules ]; then
    npm install
  fi
  npx playwright install webkit

  nohup python3 "$ROOT/Scripts/injection-test-server.py" --port "$PORT" > "$LOG" 2>&1 &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
  sleep 1

  export INJECTION_TEST_URL="http://127.0.0.1:$PORT/injection-lab/"
  node test-injection.mjs
  echo "OK — Playwright injection tests passed"
else
  echo "npm not found — running Python smoke tests (install node+npm for full WebKit tests)"
  python3 "$ROOT/Scripts/validate-injection.py"
fi