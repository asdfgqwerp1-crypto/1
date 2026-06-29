#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8090}"
LOG="/tmp/safarispoof-injection-test.log"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
fi

VENV="${VENV:-/tmp/safarispoof-venv}"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install playwright -q
  "$VENV/bin/python" -m playwright install webkit
fi

export INJECTION_TEST_PORT="$PORT"
"$VENV/bin/python" "$ROOT/Scripts/test-injection.py"
echo "OK — Playwright WebKit injection tests passed"