#!/usr/bin/env bash
# Read-only. Asks Bind directly for fixed names plus one alias per running package. Pass more names as args
# (e.g. hoodi-reth.dappnode). Compare with a run from before the change: names must keep resolving. IPs can change when a container is recreated, and google/github answers rotate.
IMG=$(docker inspect DAppNodeCore-dappmanager.dnp.dappnode.eth --format '{{.Config.Image}}')
EXTRA=$(docker ps --format '{{.Names}}' | grep '^DAppNodePackage-' | sed -E 's/^DAppNodePackage-//; s/\.dnp\.dappnode\.eth$/.dappnode/; s/\.public\.dappnode\.eth$/.public.dappnode/' | sort -u | tr '\n' ' ')
docker run --rm --network dncore_network -e EXTRA="$EXTRA $*" --entrypoint sh "$IMG" -c '
for n in my.dappnode dappmanager.dappnode dappnode.local ipfs.dappnode notifier.notifications.dappnode gatus.notifications.dappnode premium.premium.dappnode wifi.dappnode https.dappnode doesnotexist.dappnode $EXTRA google.com github.com; do
  printf "%-52s %s\n" "$n" "$(dig +short +time=3 +tries=1 @172.33.1.2 $n A | sort | tr "\n" " ")"
done
printf "%-52s %s\n" "AAAA google.com answered" "$(dig +short @172.33.1.2 google.com AAAA | grep -c :)"
printf "%-52s %s\n" "DNSSEC ad flag for cloudflare.com" "$(dig +dnssec @172.33.1.2 cloudflare.com | grep -c "flags:.* ad")"
printf "%-52s %s\n" "TCP query my.dappnode" "$(dig +tcp +short @172.33.1.2 my.dappnode)"
printf "%-52s %s\n" "20 parallel queries answered" "$(for i in $(seq 20); do dig +short +time=3 @172.33.1.2 my.dappnode & done | grep -c 172.33)"
'
