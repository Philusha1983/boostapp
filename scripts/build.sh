#!/usr/bin/env bash
# Build a versioned, store-ready zip of the extension.
#
#   ./scripts/build.sh          -> dist/boost-autobook-v<version>.zip
#
# The version is read from boost-autobook/manifest.json (single source of
# truth). Excludes junk files. Run from anywhere inside the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/boost-autobook"
VERSION=$(python3 -c "import json;print(json.load(open('$SRC/manifest.json'))['version'])")
OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/boost-autobook-v$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

cd "$SRC"
zip -qr "$OUT" . \
  -x "*.DS_Store" \
  -x "standalone/*" \
  -x "*.zip"

echo "Built  : $OUT"
echo "Version: $VERSION"
echo
echo "Release checklist:"
echo "  0. Add a WHATS_NEW[\"$VERSION\"] entry in boost-autobook/walkthrough.js"
echo "     (5 languages; optionally a tour step tagged addedIn) — users see it once after updating"
echo "  1. Update CHANGELOG.md (move Unreleased -> $VERSION)"
echo "  2. git commit -am 'Release v$VERSION'"
echo "  3. git tag -a v$VERSION -m 'v$VERSION' && push with tags"
echo "     (pushing the tag triggers the GitHub Release workflow)"
