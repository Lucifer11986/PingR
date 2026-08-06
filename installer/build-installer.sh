#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$SCRIPT_DIR/electron"

cd "$DESKTOP_DIR"
npm ci

case "${1:-linux}" in
  linux) npm run build:linux ;;
  windows|win) npm run build:win ;;
  mac|macos) npm run build:mac ;;
  all) npm run build:all ;;
  *) echo "Verwendung: $0 [linux|windows|macos|all]" >&2; exit 2 ;;
esac

echo "Installer liegen in: $(cd "$SCRIPT_DIR/../desktop-dist" && pwd)"

