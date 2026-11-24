#!/usr/bin/env sh
# Meow Image Compressor: install (first run), build if needed, start and open the browser.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js 18 or newer is required: https://nodejs.org"; exit 1; }
[ -d node_modules ] || { echo "Installing dependencies (first run)..."; npm install || exit 1; }
exec node scripts/start.mjs "$@"
