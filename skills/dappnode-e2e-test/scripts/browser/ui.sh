#!/usr/bin/env bash
# usage: ui.sh <step.js | -> [KEY=VALUE ...]   Env: TIMEOUT (seconds, default 600), E2E_PORT
# A step is the body of an async function with: page ctx events fs dir UI h ARGS
set -euo pipefail
E2E_DIR=${DAPPNODE_E2E_DIR:-$HOME/.cache/dappnode-e2e}
STEP=$1; shift
ARGS=$(python3 -c 'import json,sys; print(json.dumps(dict(a.split("=",1) for a in sys.argv[1:])))' "$@")
{ printf 'const ARGS = %s;\n' "$ARGS"; cat "$STEP"; } |
  curl -sS -m "${TIMEOUT:-600}" -X POST -H "x-e2e-token: $(cat "$E2E_DIR/token")" --data-binary @- "http://127.0.0.1:${E2E_PORT:-9333}/"
echo
