#!/usr/bin/env bash
for p in 8080 8443; do
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$p" 2>/dev/null | xargs -r kill 2>/dev/null && echo "Stopped port $p" || echo "Port $p not running"
  fi
done