#!/usr/bin/env bash
# Starts the controller in the foreground: run it as a background task. Env: DAPPNODE_UI, E2E_PORT.
set -euo pipefail
E2E_DIR=$("$(dirname "$0")/setup.sh")
cd "$E2E_DIR"
exec node daemon.mjs
