#!/usr/bin/env bash
# Read-only. State of each core service, with secrets only as fingerprints. Skips what is not installed.
IMG=$(docker inspect DAppNodeCore-dappmanager.dnp.dappnode.eth --format '{{.Config.Image}}')
ip() { docker inspect "$1" --format '{{(index .NetworkSettings.Networks "dncore_network").IPAddress}}' 2>/dev/null; }
get() { docker run --rm --network dncore_network --entrypoint curl "$IMG" -s -m 20 "$@"; }
exists() { docker inspect "$1" >/dev/null 2>&1; }

echo "== dappmanager: node $(docker exec DAppNodeCore-dappmanager.dnp.dappnode.eth node -v)"

H=DAppNodeCore-https.dnp.dappnode.eth
if exists "$H"; then echo "== https: mappings $(get "http://$(ip $H):5000/?format=json" | sed -E 's/"auth":"[^"]+"/"auth":"<set>"/g')"; echo "   nginx files: $(docker exec $H ls /etc/nginx/conf.d/ | tr '\n' ' ')"; fi

W=DAppNodeCore-wifi.dnp.dappnode.eth
if exists "$W"; then echo "== wifi: AP-ENABLED=$(docker logs $W 2>&1 | grep -c AP-ENABLED) hostapd=$(docker exec $W pgrep hostapd >/dev/null 2>&1 && echo up || echo DOWN) dnsmasq=$(docker exec $W pgrep dnsmasq >/dev/null 2>&1 && echo up || echo DOWN) stations=$(docker exec $W sh -c 'iw dev wlan0 station dump 2>/dev/null | grep -c ^Station')"; fi

T=DAppNodePackage-tailscale.tailscale.dnp.dappnode.eth
if exists "$T"; then docker exec $T tailscale status --json 2>/dev/null | python3 -c '
import json, sys
d = json.load(sys.stdin); s = d.get("Self", {})
print("== tailscale:", d.get("BackendState"), "| online", s.get("Online"), "| node", (s.get("ID") or "")[-6:], "| peers", len(d.get("Peer") or {}), "| routes", s.get("PrimaryRoutes"), "| health", d.get("Health") or "ok", "| client", d.get("Version", "")[:12])'; fi

P=DAppNodeCore-premium.premium.dnp.dappnode.eth
if exists "$P"; then echo "== premium: validate $(get "http://$(ip $P):8080/api/license/validate")"; docker exec $P cat /app/db/license 2>/dev/null | python3 -c '
import hashlib, json, sys
raw = sys.stdin.read()
if not raw.strip(): print("   license file: empty (no license)"); sys.exit()
d = json.loads(raw); fp = lambda v: hashlib.sha256(v.encode()).hexdigest()[:10]
print("   license: key fp", fp(d["key"]), "| hash fp", fp(d["hash"]), "| hash == sha256(key)[:16]:", d["hash"] == hashlib.sha256(d["key"].encode()).digest()[:16].hex())'; fi

G=DAppNodeCore-gatus.notifications.dnp.dappnode.eth
if exists "$G"; then docker exec $G sh -c 'curl -s localhost:8080/api/v1/endpoints/statuses' | python3 -c '
import json, sys
d = json.load(sys.stdin)
ok = [e for e in d if e["results"] and e["results"][-1]["success"]]
print("== gatus:", len(ok), "of", len(d), "checks passing, longest history", max((len(e["results"]) for e in d), default=0))
for e in d:
    if e["results"]: print("   ", e["name"], "->", e["results"][-1]["success"], e["results"][-1]["conditionResults"][0]["condition"] if e["results"][-1].get("conditionResults") else "")'
  echo "   notifier health: $(docker exec $G sh -c 'curl -s -m 5 -o /dev/null -w %{http_code} http://notifier.notifications.dappnode:8080/api/v1/health')"; fi

I=DAppNodeCore-ipfs.dnp.dappnode.eth
if exists "$I"; then echo "== ipfs: $(docker inspect $I --format '{{.State.Status}}')"; fi
