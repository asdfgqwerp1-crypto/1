#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8093}"

VENV="${VENV:-/tmp/safarispoof-venv}"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install playwright -q
  "$VENV/bin/python" -m playwright install webkit
fi

export FRAME_TEST_PORT="$PORT"
"$VENV/bin/python" "$ROOT/Scripts/test-frame-pipeline.py"
echo "OK — frame pipeline WebKit tests passed"