#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$(dirname "$0")/.github-token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "Missing $TOKEN_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$TOKEN_FILE"

cd "$ROOT"
git remote set-url origin "https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git"
git push "https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git" main "$@"
echo "Pushed to https://github.com/${GITHUB_USER}/${GITHUB_REPO}"