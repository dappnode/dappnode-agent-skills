#!/usr/bin/env bash
# Installs playwright into the state dir (no browser download: it drives the installed Chrome).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
E2E_DIR=${DAPPNODE_E2E_DIR:-$HOME/.cache/dappnode-e2e}
mkdir -p "$E2E_DIR"
cd "$E2E_DIR"
[ -f package.json ] || npm init -y >/dev/null
[ -f node_modules/playwright/index.js ] || PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright >/dev/null 2>&1
cp "$HERE/daemon.mjs" daemon.mjs
echo "$E2E_DIR"
