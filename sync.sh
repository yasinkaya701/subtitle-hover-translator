#!/bin/bash

# Configuration
SOURCE_DIR="src/extension"
SAFARI_IOS_RES="platforms/safari-ios/Subtitle Hover Translator/Subtitle Hover Translator Extension/Resources"
SAFARI_MAC_RES="platforms/safari-macos/Subtitle Hover Translator for Mac/Subtitle Hover Translator for Mac Extension/Resources"
CHROME_OUT="output/share/Subtitle Hover Translator Chrome"

FILES=("background.js" "content.js" "content.css" "popup.js" "popup.html" "popup.css" "manifest.json")

echo "=== Syncing files from $SOURCE_DIR ==="

for f in "${FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$f" ]; then
        cp "$SOURCE_DIR/$f" "$SAFARI_IOS_RES/$f"
        cp "$SOURCE_DIR/$f" "$SAFARI_MAC_RES/$f"
        cp "$SOURCE_DIR/$f" "$CHROME_OUT/$f"
        echo "Synced: $f"
    else
        echo "Warning: $SOURCE_DIR/$f not found"
    fi
done

# Sync icons directory
if [ -d "$SOURCE_DIR/icons" ]; then
    cp -R "$SOURCE_DIR/icons/" "$SAFARI_IOS_RES/icons/"
    cp -R "$SOURCE_DIR/icons/" "$SAFARI_MAC_RES/icons/"
    cp -R "$SOURCE_DIR/icons/" "$CHROME_OUT/icons/"
    echo "Synced: icons directory"
fi

# Personalize manifest names for Safari to distinguish them
# Using a more robust sed pattern
sed -i '' 's/"name": *"[^"]*"/"name": "Subtitle Hover (iOS)"/' "$SAFARI_IOS_RES/manifest.json"
sed -i '' 's/"name": *"[^"]*"/"name": "Subtitle Hover (macOS)"/' "$SAFARI_MAC_RES/manifest.json"
echo "Personalized manifest.json names for Safari targets."

echo ""
echo "=== Rebuilding macOS Safari Extension (Clean) ==="

# Define the DerivedData path manually to be safe
DERIVED_DATA_PATH=~/Library/Developer/Xcode/DerivedData
PROJECT_DIR="platforms/safari-macos/Subtitle Hover Translator for Mac"

# Find and clear DerivedData for both projects
find "$DERIVED_DATA_PATH" -maxdepth 1 \( -name "Subtitle_Hover_Translator-*" -o -name "Subtitle_Hover_Translator_for_Mac-*" \) -exec rm -rf {} +
echo "Cleared build caches (DerivedData) for both projects."

cd "$PROJECT_DIR" || exit
xcodebuild clean build -project "Subtitle Hover Translator for Mac.xcodeproj" -scheme "Subtitle Hover Translator for Mac" -configuration Debug 2>&1 | tail -n 10

if [ $? -eq 0 ]; then
    echo ""
    echo "=== Build Succeeded. Installing and Restarting App ==="
    # Re-find the app in its build folder if the previous link fails
    APP_PATH=$(find "$DERIVED_DATA_PATH" -name "Subtitle Hover (macOS).app" | grep "Build/Products/Debug" | head -1)
    
    if [ -n "$APP_PATH" ]; then
        cp -R "$APP_PATH" ~/Applications/
        open ~/Applications/"Subtitle Hover (macOS).app"
        echo "Success! The extension has been updated and the app has been restarted."
    else
        echo "Error: Could not find build app bundle."
    fi
else
    echo "Error: Build failed."
fi
