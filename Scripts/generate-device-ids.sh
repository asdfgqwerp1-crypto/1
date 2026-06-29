#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <profile-prefix> [count]"
  exit 1
fi

PREFIX="$1"
COUNT="${2:-3}"

for i in $(seq 1 "$COUNT"); do
  ID=$(python3 -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_DNS, '${PREFIX}-${i}'))")
  echo "device-${i}: ${ID}"
done