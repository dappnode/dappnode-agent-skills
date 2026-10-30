# Gotchas

Check here before calling something a regression. These come from real runs, but versions move on: if it matters, confirm in the code.

## Expected noise

| You see | What it is |
|---|---|
| `Service Worker not supported` on every page | Browser APIs missing over plain HTTP |
| `Port N TCP/UDP is not open` | No port forwarding or UPnP on the node's network |
| `getaddrinfo ENOTFOUND ipfs.dappnode`, "Could not pin", IPFS page errors, auto-diagnose "ipfs … not running" | The IPFS package is stopped; check it first |
| `All IPFS gateways failed (500/504)`, avatar 502s | Remote gateways struggling. Wait and retry |
| `all RPC endpoints failed`, `fetchCoreUpdateData`, `http://beacon-chain.mainnet…: fetch failed` | No mainnet beacon on the node, plus flaky remote RPC. Some UI data then fails to load until a retry |
| `ETIMEDOUT` or `AggregateError` on bursts of requests while `curl` succeeds | Node's 250 ms per-attempt connection limit (`autoSelectFamily`), unless that has since been fixed. Same on Node 22 and 24. `--network-family-autoselection-attempt-timeout=2000` makes it vanish |
| `container … already connected to network dncore_network with wrong IP`, `VPN DB not imported` | Normal DAPPMANAGER startup warnings; the first also means requests fail for a few seconds after boot |
| `HeadersTimeoutError` from `notificationsGetBanner` | One-off while Bind or the notifier restarts. Only worth a look if it repeats |
| `premiumIsLicenseActive: Bad Request` | No license on the node |
| Many short-lived containers with random names during a core update, about 30 a minute | DAPPMANAGER's host jobs and restart tool. Check they exit 0 and stop within a couple of minutes |
| Lighthouse `Execution engine call failed … Unsupported fork` | Client-level, not Dappnode |
| Tailscale: `TPM: error`, `src_valid_mark`, iptables "not supported" then nftables | Normal inside the container |

## Network

- Home connections drop packets. Measure with `ping` from both the node and another machine before blaming software, and remember blocks of failures can be the uplink.
- Compare versions interleaved (new, old, new, old). Running old then new once proves little. An early "regression" here turned out to be a cold image pull on the first run.
- After a restart, `dig` for a recreated container can return a new IP. Names should still resolve.

## UI

- **Stakers cards:** a client is preselected only if selected, installed **and running** (`isOkSelectedInstalledAndRunning`), and `status: ok` needs an RPC lookup. A paused client or an RPC failure shows nothing selected while the DB is unchanged, and Apply then fails or looks odd. Reload until the selection appears.
- **Stakers page** opens on mainnet: Hoodi is `/stakers/hoodi`, and the MAINNET/TESTNET switch is one button.
- **Applying stakers** shows Terms of Use with a checkbox each time. "Accept and Continue" stays disabled until it's ticked.
- **Package row icons** are bare SVGs under `.list-grid.containers`: first pause, second restart. "Pause" and "Restart" text are column headers. The first row of a multi-service package is "All containers".
- **Pause showing CRASHED** means a non-zero exit on SIGTERM (Snowflake exits 2). Check `docker events`.
- **Remove icon** in the HTTPS grid is the last SVG; the earlier one is an arrow.
- **HTTPS password rule:** Add mapping stays disabled without 8+ chars, upper, lower and a number.
- **"Enable auto-updates?" after install:** `settleDialogs` cancels it. Enabling it on a core package writes a per-package entry that nothing reads, because core updates follow only "System packages" and the package updater skips core. It doesn't appear in the UI, so it can't be removed there.
- **Snowflake image** has no shell and no `/tmp`. Use `/etc/` in the file manager and `docker cp` to inspect.
- **File manager uploads over about 750 KB fail** with a dropped connection and no clear error: the file goes as one Socket.IO message, and the 1 MB `maxHttpBufferSize` default applies after base64. Long-standing, unless fixed since.
- **The download error page** shows a raw stack trace.

## Timing

- **Notifications settings:** the notifier debounces for about 10 s after `POST /gatus/endpoints/reload`, then rewrites `config.yaml`; Gatus rereads it within about 30 s. Check too early and nothing has changed.
- **Two changes inside the debounce window** collapse into one, so wait between off and on.
- **Alerts:** syncing checks need 4 failures × 30 s, peers checks 10 × 30 s.

## Product behaviour that looks like a bug

- **Notifier "has errors … Skipping processing":** alerts where the check couldn't connect are dropped on purpose, so pausing a client proves delivery but won't reach the inbox.
- **No "resolved" alert after a threshold change:** Gatus tracks triggered alerts by a checksum including the description, and the description contains the threshold.
- **HTTPS 403 from `172.33.x`:** internal mappings allow `172.16.0.0/12`, which stops at `172.31`. Test from `10.20.x`, the address the real DNS name returns. A request without a known hostname gets dropped (`000`).
- **Tailscale health "IP forwarding is disabled":** v4 forwarding is on; v6 is off while the exit node advertises `::/0`. Subnet routing still works.
- **HTTPS isn't in DNP_CORE:** it was removed on purpose, and updates arrive through the normal package path. Packages in `corePackagesNotAutoupdatable` only update through core.
- **A failed Premium activation overwrites the license file.** With no license, the original state is an **empty** `/app/db/license`: restore with `: > /app/db/license`, not by deleting it.
- **Old containers exiting 137 or 2 during an update** reflect how the old version shuts down.

## Shell and tooling

- macOS `zsh`: unquoted variables don't split, so don't store commands in variables; globs that match nothing abort the line (`--include=*.ts`); `path` is tied to `PATH`, so never `read repo path`. Prefer `bash` scripts.
- `pkill -f` over SSH can match the SSH command itself and kill the session. Stop by PID.
- `/tmp` gets cleaned on macOS, leaving empty folders. Keep state in `~/.cache`.
- A long foreground command on a dropped page just waits. Bound every loop and return a status.
- When checking with `grep -c` or `diff`, confirm the input isn't empty.
- Automated safety checks may block deploy-like commands until the conversation states it's a spare test node, and block credential downloads such as VPN configs. Don't work around them; explain and let the user decide.
