#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <baseline.json> <spoof.json>"
  exit 1
fi

BASELINE="$1"
SPOOF="$2"

if [ ! -f "$BASELINE" ]; then
  echo "Baseline not found: $BASELINE"
  exit 1
fi

if [ ! -f "$SPOOF" ]; then
  echo "Spoof report not found: $SPOOF"
  exit 1
fi

python3 - "$BASELINE" "$SPOOF" <<'PY'
import json, sys

baseline_path, spoof_path = sys.argv[1], sys.argv[2]

with open(baseline_path) as f:
    baseline = json.load(f)
with open(spoof_path) as f:
    spoof = json.load(f)

CRITICAL = {
    "userAgent", "platform", "vendor", "maxTouchPoints",
    "hardwareConcurrency", "webdriver", "screen", "webgl"
}

def flatten(obj, prefix=""):
    items = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            items.update(flatten(v, key))
    else:
        items[prefix] = obj
    return items

b = flatten(baseline)
s = flatten(spoof)

all_keys = sorted(set(b) | set(s))
fail = warn = pass_ = 0

print("=== Safari Spoof Diff Report ===\n")

for key in all_keys:
    bv, sv = b.get(key), s.get(key)
    top = key.split(".")[0]
    if bv == sv:
        status = "PASS"
        pass_ += 1
    elif top in CRITICAL or key in CRITICAL:
        status = "FAIL"
        fail += 1
    else:
        status = "WARN"
        warn += 1
    print(f"[{status}] {key}")
    if bv != sv:
        print(f"       baseline: {bv!r}")
        print(f"       spoof:    {sv!r}")

print(f"\nSummary: PASS={pass_} WARN={warn} FAIL={fail}")
sys.exit(1 if fail > 0 else 0)
PY