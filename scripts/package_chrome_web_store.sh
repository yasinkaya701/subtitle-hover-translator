#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/browser-extension"
OUTPUT_DIR="$ROOT_DIR/output/chrome-web-store"
STAGE_DIR="$OUTPUT_DIR/.stage"
VERSION="$(python3 - <<'PY'
import json
from pathlib import Path
manifest = json.loads(Path("browser-extension/manifest.json").read_text())
print(manifest["version"])
PY
)"
ZIP_PATH="$OUTPUT_DIR/Subtitle-Hover-Translator-chrome-$VERSION.zip"

mkdir -p "$OUTPUT_DIR"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude '__MACOSX' \
  "$EXT_DIR/" "$STAGE_DIR/"

rm -f "$ZIP_PATH"
(
  cd "$STAGE_DIR"
  zip -r -X "$ZIP_PATH" .
)

rm -rf "$STAGE_DIR"
printf 'Chrome Web Store package: %s\n' "$ZIP_PATH"
