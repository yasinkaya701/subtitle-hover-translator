#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/safari-extension-macos/Subtitle Hover Translator for Mac/Subtitle Hover Translator for Mac.xcodeproj"
SCHEME_NAME="Subtitle Hover Translator for Mac"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-/tmp/sht-macos-derived-data}"
UNSIGNED_DERIVED_DATA_PATH="${UNSIGNED_DERIVED_DATA_PATH:-/tmp/sht-macos-unsigned-derived-data}"
BUILD_LOG_PATH="${BUILD_LOG_PATH:-/tmp/sht-macos-build.log}"
APP_NAME="Subtitle Hover Translator for Mac.app"
APP_SOURCE_PATH=""
APP_INSTALL_PATH="$HOME/Applications/Subtitle Hover Translator for Mac Dev.app"
EXTENSION_BUNDLE_ID="com.yasinkaya.subtitlehovertranslator.macos.extension"
EXTENSION_NAME="Subtitle Hover Translator for Mac"
AUTOMATION_ARG="--open-safari-extension-preferences"
APP_ENTITLEMENTS_PATH="${APP_ENTITLEMENTS_PATH:-/tmp/sht-macos-app.entitlements}"
EXTENSION_ENTITLEMENTS_PATH="${EXTENSION_ENTITLEMENTS_PATH:-/tmp/sht-macos-ext.entitlements}"

warn_if_team_missing() {
  local build_settings
  build_settings="$(xcodebuild -project "$PROJECT_PATH" -scheme "$SCHEME_NAME" -showBuildSettings 2>/dev/null || true)"
  if grep -q "_DEVELOPMENT_TEAM_IS_EMPTY = YES" <<<"$build_settings"; then
    cat <<'EOF'
Uyari: Xcode projesinde `Development Team` bos.
Bu durumda build "Sign to Run Locally" ile gecer, ancak Safari uzantiyi listede gostermeyebilir.
Gerekirse Xcode > Settings > Accounts icinde Apple hesabinizi ekleyip
target'larda `Signing & Capabilities > Team` secin.
EOF
  fi
}

build_signed_app() {
  xcodebuild \
    -project "$PROJECT_PATH" \
    -scheme "$SCHEME_NAME" \
    -configuration Debug \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    build
}

build_unsigned_app() {
  xcodebuild \
    -project "$PROJECT_PATH" \
    -scheme "$SCHEME_NAME" \
    -configuration Debug \
    -derivedDataPath "$UNSIGNED_DERIVED_DATA_PATH" \
    CODE_SIGNING_ALLOWED=NO \
    build
}

pick_signing_identity() {
  local identity_hash
  identity_hash="$(security find-identity -v -p codesigning | awk '/Apple Development:/ { print $2; exit }')"

  if [[ -z "$identity_hash" ]]; then
    cat <<'EOF'
Uyari: `Apple Development` signing identity bulunamadi.
Xcode > Settings > Accounts altinda hesabinizi ekleyip
`Manage Certificates...` icinden bir development certificate olusturun.
EOF
    return 1
  fi

  printf '%s\n' "$identity_hash"
}

needs_manual_signing() {
  local app_path="$1"
  local signature_output
  signature_output="$(codesign -dvvv "$app_path" 2>&1 || true)"

  if grep -q 'Authority=Apple Development:' <<<"$signature_output"; then
    return 1
  fi

  return 0
}

write_entitlements() {
  rm -f "$APP_ENTITLEMENTS_PATH" "$EXTENSION_ENTITLEMENTS_PATH"

  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.app-sandbox bool true' "$APP_ENTITLEMENTS_PATH" >/dev/null
  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.files.user-selected.read-only bool true' "$APP_ENTITLEMENTS_PATH" >/dev/null
  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.network.client bool true' "$APP_ENTITLEMENTS_PATH" >/dev/null
  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.get-task-allow bool true' "$APP_ENTITLEMENTS_PATH" >/dev/null

  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.app-sandbox bool true' "$EXTENSION_ENTITLEMENTS_PATH" >/dev/null
  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.files.user-selected.read-only bool true' "$EXTENSION_ENTITLEMENTS_PATH" >/dev/null
  /usr/libexec/PlistBuddy -c 'Add :com.apple.security.get-task-allow bool true' "$EXTENSION_ENTITLEMENTS_PATH" >/dev/null
}

manual_sign_app() {
  local app_path="$1"
  local certificate_hash="$2"
  local extension_path="$app_path/Contents/PlugIns/Subtitle Hover Translator for Mac Extension.appex"
  local path

  write_entitlements

  for path in \
    "$extension_path/Contents/MacOS/__preview.dylib" \
    "$extension_path/Contents/MacOS/Subtitle Hover Translator for Mac Extension.debug.dylib" \
    "$extension_path/Contents/MacOS/Subtitle Hover Translator for Mac Extension"
  do
    [[ -e "$path" ]] || continue
    /usr/bin/codesign --force --sign "$certificate_hash" --timestamp=none "$path"
  done

  /usr/bin/codesign \
    --force \
    --sign "$certificate_hash" \
    --timestamp=none \
    --options runtime \
    --entitlements "$EXTENSION_ENTITLEMENTS_PATH" \
    "$extension_path"

  for path in \
    "$app_path/Contents/MacOS/__preview.dylib" \
    "$app_path/Contents/MacOS/Subtitle Hover Translator for Mac.debug.dylib" \
    "$app_path/Contents/MacOS/Subtitle Hover Translator for Mac"
  do
    [[ -e "$path" ]] || continue
    /usr/bin/codesign --force --sign "$certificate_hash" --timestamp=none "$path"
  done

  /usr/bin/codesign \
    --force \
    --sign "$certificate_hash" \
    --timestamp=none \
    --options runtime \
    --entitlements "$APP_ENTITLEMENTS_PATH" \
    "$app_path"

  /usr/bin/codesign --verify --verbose=2 "$extension_path"
  /usr/bin/codesign --verify --verbose=2 "$app_path"
}

install_app() {
  local app_path="$1"

  mkdir -p "$(dirname "$APP_INSTALL_PATH")"
  rm -rf "$APP_INSTALL_PATH"
  ditto "$app_path" "$APP_INSTALL_PATH"
  APP_SOURCE_PATH="$APP_INSTALL_PATH"
}

build_app() {
  local certificate_hash

  rm -f "$BUILD_LOG_PATH"

  if build_signed_app >"$BUILD_LOG_PATH" 2>&1; then
    APP_SOURCE_PATH="$DERIVED_DATA_PATH/Build/Products/Debug/$APP_NAME"

    if needs_manual_signing "$APP_SOURCE_PATH"; then
      certificate_hash="$(pick_signing_identity)"
      manual_sign_app "$APP_SOURCE_PATH" "$certificate_hash"
    fi

    install_app "$APP_SOURCE_PATH"
    return 0
  fi

  if ! grep -Eq 'No signing certificate "Mac Development" found|No Account for Team|Sign to Run Locally' "$BUILD_LOG_PATH"; then
    cat "$BUILD_LOG_PATH"
    return 1
  fi

  printf '%s\n' 'Signed build basarisiz oldu; unsigned build + local codesign fallback kullaniliyor.'
  certificate_hash="$(pick_signing_identity)"
  build_unsigned_app
  APP_SOURCE_PATH="$UNSIGNED_DERIVED_DATA_PATH/Build/Products/Debug/$APP_NAME"
  manual_sign_app "$APP_SOURCE_PATH" "$certificate_hash"
  install_app "$APP_SOURCE_PATH"
}

ensure_gui_scripting_access() {
  local ui_enabled
  ui_enabled="$(osascript -s o -e 'tell application "System Events" to UI elements enabled' 2>/dev/null || true)"
  if [[ "$ui_enabled" == "true" ]]; then
    return 0
  fi

  cat <<'EOF'
GUI scripting kapali. Script uzanti ayarini acti ve PlugInKit durumunu "use" yapti,
ama Safari icindeki checkbox'i otomatik tiklamak icin Codex veya Terminal icin
`Sistem Ayarlari > Gizlilik ve Guvenlik > Erisilebilirlik` izni vermen gerekiyor.
Izni verdikten sonra script'i tekrar calistir.
EOF
  return 1
}

launch_preferences() {
  pkill -x "$SCHEME_NAME" >/dev/null 2>&1 || true
  open -na "$APP_INSTALL_PATH" --args "$AUTOMATION_ARG"
}

enable_with_pluginkit() {
  pluginkit -r "$APP_INSTALL_PATH" >/dev/null 2>&1 || true
  pluginkit -a "$APP_INSTALL_PATH/Contents/PlugIns/Subtitle Hover Translator for Mac Extension.appex" >/dev/null
  pluginkit -e use -i "$EXTENSION_BUNDLE_ID" >/dev/null
  pluginkit -m -v -i "$EXTENSION_BUNDLE_ID"
}

enable_in_safari_ui() {
  EXTENSION_NAME="$EXTENSION_NAME" osascript <<'APPLESCRIPT'
on run
  set extensionName to system attribute "EXTENSION_NAME"

  tell application "Safari" to activate

  tell application "System Events"
    tell process "Safari"
      set frontmost to true
      set settingsWindow to missing value

      repeat 40 times
        try
          if (count of windows) > 0 then
            set settingsWindow to window 1
            exit repeat
          end if
        end try
        delay 0.5
      end repeat

      if settingsWindow is missing value then
        error "Safari ayar penceresi bulunamadi."
      end if

      set matchingCheckbox to my findMatchingCheckbox(settingsWindow, extensionName)
      if matchingCheckbox is missing value then
        error "Uzanti checkbox'i bulunamadi. Safari ayar penceresi acildi; checkbox'i bir kez elle isaretlemeniz gerekebilir."
      end if

      if value of matchingCheckbox is 0 then
        click matchingCheckbox
        delay 0.5
      end if
    end tell
  end tell

  return "Safari uzantisi etkin."
end run

on findMatchingCheckbox(settingsWindow, extensionName)
  tell application "System Events"
    tell process "Safari"
      try
        set matchingCheckboxes to (every checkbox of entire contents of settingsWindow whose name contains extensionName)
        if (count of matchingCheckboxes) > 0 then
          return item 1 of matchingCheckboxes
        end if
      end try

      try
        set allCheckboxes to every checkbox of entire contents of settingsWindow
        if (count of allCheckboxes) is 1 then
          return item 1 of allCheckboxes
        end if
      end try
    end tell
  end tell

  return missing value
end findMatchingCheckbox
APPLESCRIPT
}

main() {
  warn_if_team_missing
  build_app
  enable_with_pluginkit
  launch_preferences

  if ensure_gui_scripting_access; then
    if ! enable_in_safari_ui; then
      cat <<'EOF'
Safari ayar penceresi acildi ama uzanti satiri bulunamadi.
Eger listede `Subtitle Hover Translator` hic gorunmuyorsa sorun GUI degil signing tarafindadir:
- Xcode > Settings > Accounts icinde Apple hesabi tanimli olmali
- target'larda `Signing & Capabilities > Team` secili olmali
- tekrar build alindiginda `Sign to Run Locally` yerine development signing kullanilmali
EOF
      return 1
    fi
  fi
}

main "$@"
