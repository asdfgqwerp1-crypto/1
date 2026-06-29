#!/usr/bin/env bash
# Упаковать проект для сборки на Mac без GitHub OAuth
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ios-spoofing-build.zip"

cd "$ROOT"
rm -f "$OUT"
zip -r "$OUT" . \
  -x "*.git*" \
  -x "Scripts/certs/*" \
  -x "*/build/*" \
  -x "*.ipa" \
  -x "docs/safari-diff-baseline/.gitkeep"

echo ""
echo "Готово: $OUT"
echo "Размер: $(du -h "$OUT" | cut -f1)"
echo ""
echo "Скопируйте zip на Windows (папка IOS SPOOFING на hgfs)"
echo "и загрузите на облачный Mac или откройте в Xcode."