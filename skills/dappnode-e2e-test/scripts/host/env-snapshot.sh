#!/usr/bin/env bash
# Read-only. Every container's env for before/after diffs; secret-looking values only as short fingerprints.
docker ps -a --format '{{.Names}}' | grep -E '^DAppNode(Core|Package)-' | sort | while read -r c; do
  docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' | C="$c" python3 -c '
import hashlib, os, sys
name = os.environ["C"].split(".")[0].replace("DAppNodeCore-", "").replace("DAppNodePackage-", "")
skip = ("PATH", "HOME", "HOSTNAME", "GOLANG_VERSION", "GOPATH", "GOTOOLCHAIN", "NODE_VERSION", "YARN_VERSION", "LANG")
for line in sys.stdin:
    k, _, v = line.rstrip("\n").partition("=")
    if not k or k in skip: continue
    if any(s in k.upper() for s in ("PASS", "KEY", "SECRET", "TOKEN", "AUTH", "PRIVATE", "MNEMONIC")):
        v = "fp:" + hashlib.sha256(v.encode()).hexdigest()[:10]
    print(f"{name}  {k}={v}")
'
done
