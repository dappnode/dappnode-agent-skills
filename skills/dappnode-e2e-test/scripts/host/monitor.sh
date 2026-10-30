#!/usr/bin/env bash
# usage: monitor.sh start|stop|summary   Records container events, version changes and dappmanager logs in ~/e2e-monitor.
M=~/e2e-monitor
case "${1:-}" in
start)
  rm -rf "$M"; mkdir -p "$M"
  docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' | sort > "$M/before.txt"
  cat > "$M/run.sh" <<'RUN'
#!/usr/bin/env bash
M=~/e2e-monitor
docker events --filter type=container --filter event=start --filter event=die --filter event=destroy --format '{{.TimeNano}}|{{.Action}}|{{.Actor.Attributes.name}}|{{.Actor.Attributes.image}}|exit={{index .Actor.Attributes "exitCode"}}' >> "$M/events.log" 2>&1 &
( while true; do docker logs -f --since 1s -t DAppNodeCore-dappmanager.dnp.dappnode.eth >> "$M/dappmanager.log" 2>&1; echo "--- $(date -u +%H:%M:%S) dappmanager log stream ended" >> "$M/dappmanager.log"; sleep 2; done ) &
wait
RUN
  chmod +x "$M/run.sh"
  # Own session: stop kills the process group by id. A pkill pattern would also match the ssh command running it.
  nohup setsid "$M/run.sh" > "$M/monitor.out" 2>&1 < /dev/null &
  echo $! > "$M/pid"
  echo "monitor started $(date -u +%H:%M:%S) UTC"
  ;;
stop)
  P=$(cat "$M/pid" 2>/dev/null) && kill -- "-$P" 2>/dev/null
  echo "monitor stopped, logs kept in $M"
  ;;
summary)
  echo "== resolved set"; grep -A12 'Resolved request' "$M/dappmanager.log" | sed -E 's/^[^ ]+ //' | grep -E "dnp\.dappnode|public\.dappnode|name:|ver:" | head -24
  echo "== install results"; grep -E 'RPC (success|error) packageInstall|Package started' "$M/dappmanager.log" | cut -c1-130
  echo "== named container changes"; grep -E '\|(die|start)\|DAppNode' "$M/events.log" | awk -F'|' '{ cmd="date -u -d @" substr($1,1,10) " +%H:%M:%S"; cmd | getline t; close(cmd); print "  " t, $2, $3, $4, $5 }'
  echo "== helper containers: $(grep -cE '\|start\|[a-z]+_[a-z]+\|' "$M/events.log"), non-zero exits: $(grep -E '\|die\|[a-z]+_[a-z]+\|' "$M/events.log" | grep -vc 'exit=0$')"
  echo "== ERROR lines"; grep -E ' ERROR ' "$M/dappmanager.log" | sed -E 's/^[^ ]+ //' | cut -c1-120 | sort | uniq -c | sort -rn | head -12
  ;;
*) echo "usage: monitor.sh start|stop|summary"; exit 1;;
esac
