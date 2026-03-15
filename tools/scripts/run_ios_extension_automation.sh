#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/safari-extension/Subtitle Hover Translator/Subtitle Hover Translator.xcodeproj"
SCHEME_NAME="Subtitle Hover Translator Automation"
DEVICE_NAME="${1:-iPhone 17}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-/tmp/sht-ui-tests-derived-data}"

xcrun simctl boot "$DEVICE_NAME" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$DEVICE_NAME" -b
xcrun simctl uninstall booted com.yasinkaya.subtitlehovertranslator >/dev/null 2>&1 || true
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -destination "platform=iOS Simulator,name=$DEVICE_NAME" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  build-for-testing

xcrun simctl install booted "$DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator/Subtitle Hover Translator.app"
xcrun simctl launch booted com.yasinkaya.subtitlehovertranslator >/dev/null 2>&1 || true
xcrun simctl terminate booted com.yasinkaya.subtitlehovertranslator >/dev/null 2>&1 || true
xcrun simctl terminate booted com.apple.Preferences >/dev/null 2>&1 || true
xcrun simctl openurl booted "App-Prefs:root=General"
sleep 2

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -destination "platform=iOS Simulator,name=$DEVICE_NAME" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  test-without-building
