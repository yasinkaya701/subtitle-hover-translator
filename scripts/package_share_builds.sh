#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE_STAMP="$(date +%Y%m%d)"
OUTPUT_DIR="$ROOT_DIR/output/share"
CHROME_STAGE_DIR="$OUTPUT_DIR/Subtitle Hover Translator Chrome"
CHROME_ZIP_PATH="$OUTPUT_DIR/Subtitle-Hover-Translator-Chrome-share-clean-$DATE_STAMP.zip"
MAC_APP_PATH="$HOME/Applications/Subtitle Hover Translator for Mac Dev.app"
MAC_APP_ZIP_PATH="$OUTPUT_DIR/Subtitle-Hover-Translator-Safari-macOS-dev-$DATE_STAMP.zip"
MAC_SOURCE_DIR="$ROOT_DIR/safari-extension-macos/Subtitle Hover Translator for Mac"
MAC_SOURCE_ZIP_PATH="$OUTPUT_DIR/Subtitle-Hover-Translator-Safari-macOS-source-$DATE_STAMP.zip"
IOS_SOURCE_DIR="$ROOT_DIR/safari-extension/Subtitle Hover Translator"
IOS_SOURCE_ZIP_PATH="$OUTPUT_DIR/Subtitle-Hover-Translator-Safari-iOS-source-$DATE_STAMP.zip"
README_PATH="$OUTPUT_DIR/README-share.md"

mkdir -p "$OUTPUT_DIR"
rm -rf "$CHROME_STAGE_DIR"
mkdir -p "$CHROME_STAGE_DIR"

rsync -a --delete \
  --exclude '.DS_Store' \
  "$ROOT_DIR/browser-extension/" "$CHROME_STAGE_DIR/"

rm -f "$CHROME_ZIP_PATH" "$MAC_APP_ZIP_PATH" "$MAC_SOURCE_ZIP_PATH" "$IOS_SOURCE_ZIP_PATH"

(
  cd "$OUTPUT_DIR"
  zip -r -X "$(basename "$CHROME_ZIP_PATH")" "$(basename "$CHROME_STAGE_DIR")"
)

if [[ -d "$MAC_APP_PATH" ]]; then
  ditto -c -k --sequesterRsrc --keepParent "$MAC_APP_PATH" "$MAC_APP_ZIP_PATH"
fi

ditto -c -k --sequesterRsrc --keepParent "$MAC_SOURCE_DIR" "$MAC_SOURCE_ZIP_PATH"
ditto -c -k --sequesterRsrc --keepParent "$IOS_SOURCE_DIR" "$IOS_SOURCE_ZIP_PATH"

cat > "$README_PATH" <<EOF
# Share Pack

Olusturma tarihi: $DATE_STAMP

## Hazir dosyalar

- Chrome: $(basename "$CHROME_ZIP_PATH")
- Safari macOS dev app: $(basename "$MAC_APP_ZIP_PATH")
- Safari macOS source: $(basename "$MAC_SOURCE_ZIP_PATH")
- Safari iOS source: $(basename "$IOS_SOURCE_ZIP_PATH")

## Chrome kurulumu

1. Chrome zip dosyasini acip klasoru cikar.
2. \`chrome://extensions\` ac.
3. \`Developer mode\` ac.
4. \`Load unpacked\` ile \`Subtitle Hover Translator Chrome\` klasorunu sec.

## Safari macOS kurulumu

1. \`$(basename "$MAC_APP_ZIP_PATH")\` arsivini ac.
2. App dosyasini \`Applications\` klasorune tasi.
3. Gerekirse sag tik \`Open\` ile ilk acilisi yap.
4. Uygulamayi bir kez ac.
5. Safari > Ayarlar > Genisletmeler icinde uzantiyi ac.
6. Safari > Ayarlar > Web Siteleri icinde site erisimini \`Izin Ver\` yap.

## Onemli not

- Safari macOS paketi development imzali, notarized degil.
- Bazi Mac'lerde Gatekeeper uyarisi verebilir; bu durumda sag tik > Open gerekir.
- iPhone/iPad icin dogrudan kurulum paketi yok. Bunun icin TestFlight veya Xcode gerekir. Bu nedenle iOS kaynak zip'i ayrica eklendi.
EOF

printf 'Chrome package: %s\n' "$CHROME_ZIP_PATH"
if [[ -f "$MAC_APP_ZIP_PATH" ]]; then
  printf 'Safari macOS app package: %s\n' "$MAC_APP_ZIP_PATH"
fi
printf 'Safari macOS source package: %s\n' "$MAC_SOURCE_ZIP_PATH"
printf 'Safari iOS source package: %s\n' "$IOS_SOURCE_ZIP_PATH"
printf 'Install guide: %s\n' "$README_PATH"
