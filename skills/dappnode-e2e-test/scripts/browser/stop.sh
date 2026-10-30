#!/usr/bin/env bash
E2E_DIR=${DAPPNODE_E2E_DIR:-$HOME/.cache/dappnode-e2e}
PID=$(cat "$E2E_DIR/daemon.pid" 2>/dev/null) || { echo "not running"; exit 0; }
kill "$PID" 2>/dev/null
for _ in 1 2 3 4 5; do kill -0 "$PID" 2>/dev/null || break; sleep 1; done
kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null
rm -f "$E2E_DIR/daemon.pid" "$E2E_DIR/token"
echo "controller stopped"
