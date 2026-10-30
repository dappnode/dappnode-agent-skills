#!/usr/bin/env bash
# Read-only. Versions, image ids, state and restart counts of every Dappnode container.
docker ps -a --format '{{.Names}}' | grep -E '^DAppNode(Core|Package)-' | sort | while read -r c; do
  docker inspect "$c" --format '{{.Name}}|{{.Config.Image}}|{{slice .Image 7 19}}|{{.State.Status}}|exit={{.State.ExitCode}}|restarts={{.RestartCount}}|started={{.State.StartedAt}}' |
    sed -E 's#^/DAppNode(Core|Package)-##; s#\|[^|]*:([^|:]+)\|#|\1|#; s#\.[0-9]+Z$#Z#' 
done | column -t -s'|'
echo "running: $(docker ps -q | wc -l)"
