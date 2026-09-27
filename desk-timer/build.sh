#!/bin/bash
# Builds "Desk Timer.app" in this folder.
#   ./build.sh            build only
#   ./build.sh --install  build and copy into /Applications
# Needs the Xcode Command Line Tools (xcode-select --install); full Xcode isn't required.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "swiftc not found. Install the Command Line Tools first:  xcode-select --install" >&2
  exit 1
fi

APP="Desk Timer.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp Info.plist "$APP/Contents/Info.plist"

swiftc -O -parse-as-library \
  -target "$(uname -m)-apple-macos12.0" \
  -o "$APP/Contents/MacOS/DeskTimer" \
  DeskTimer.swift

# Ad-hoc signature so macOS runs it without complaint on this Mac.
codesign --force --sign - "$APP"
echo "Built: $(pwd)/$APP"

if [[ "${1:-}" == "--install" ]]; then
  rm -rf "/Applications/$APP"
  cp -R "$APP" /Applications/
  echo "Installed: /Applications/$APP"
fi
