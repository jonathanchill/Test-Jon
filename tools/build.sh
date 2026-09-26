#!/usr/bin/env bash
#
# Packages the extension into dist/mail-lens-<version>.zip — just the files
# Chrome needs, no tests, tooling or node_modules.
#
#   npm run build
#
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/mail-lens-${VERSION}.zip"

rm -rf dist
mkdir -p dist

zip -qr "$OUT" \
  manifest.json \
  icons \
  src \
  README.md \
  -x '*.DS_Store'

# Chrome refuses to load an extension whose manifest it cannot parse, so fail
# the build here rather than in the browser.
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"

echo "$OUT"
unzip -l "$OUT" | tail -n +4 | head -n -2 | awk '{print "  " $4}'
