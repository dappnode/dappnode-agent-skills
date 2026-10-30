# Test matrix

Paths are relative to the skill. `ui X` means `scripts/browser/ui.sh scripts/browser/X.js`, and `host X` means `ssh "$NODE" 'bash -s' < scripts/host/X.sh`.

## Diff-to-test map

Start from what the PR changes. A dependency's major bump counts as a change to everything that uses it.

| If the diff touches | High-risk flows to run |
|---|---|
| Node, Yarn, Alpine or base image in a `Dockerfile` | Everything. Also: Docker CLI and Compose versions in the image against the host daemon, `apk` tools the app parses (`upnpc`, `dig`, `avahi`), image build on the host |
| `react`, `react-router-dom`, `vite`, `styled-components`, `packages/admin-ui` | Full sweep, deep links and reload on sub-tabs, back button, every wizard, dialogs, forms |
| `cookie-session`, `express`, `packages/dappmanager/src/api` | Login, logout, session surviving a reload and a DAPPMANAGER restart, admin-only routes (`/ping` is 403 without a session), downloads and uploads |
| `socket.io`, RPC handler | Every UI call, live logs, install progress, reconnection after restart, large messages |
| `kubo-rpc-client`, `multiformats`, `packages/toolkit`, IPFS code | Install by hash and by name, with **the IPFS package running** as well as stopped, local and remote mode in System > IPFS, pin and unpin logs, avatars |
| `ethers`, `packages/toolkit`, registry code | Dappstore list, install by name, signature status, staker page (needs ENS lookups), core update check |
| `packages/installer`, `deepmerge`, `dockerCompose` | Install, update and remove; **settings surviving an update** (env-snapshot diff); DNCORE and `dnp_repo` compose files; setup wizard with changed values; dependencies |
| `SetupWizard`, `formDataParser` | Setup wizard with real input on Wi-Fi or Tailscale, both prefilled and changed, advanced editor |
| `dockerode`, `packages/dockerApi` | Package list, container state, restart, pause, logs, file manager, volumes, networks |
| `zod`, `ajv`, `packages/schemas`, `packages/types` | Manifest and compose validation during install, RPC argument validation on every UI call |
| `packages/stakers` | Selecting, switching and removing clients, relays, the "only selected if running" logic |
| `packages/notifications`, `daemons` | Settings to Gatus, alert path, update notifications, banners |
| `packages/httpsPortal` | Mappings with and without auth, removal, `pwa` |
| `packages/hostScriptsServices` | Host scripts run (`copyHost` in logs), System > Host pages; ask before anything that changes the host |
| `packages/migrations`, `packages/db` | DB files after a restart, upgrade from the last released version, rollback |
| `packages/upnpc`, `dyndns`, `chains`, `nexus`, `ethicalMetrics`, `optimism`, `dashboardServer` | The matching area below; check it exists on the node first |

Example, a dependency PR with `react-router-dom` 7, `cookie-session` 2, `kubo-rpc-client` 5, `multiformats` 14, `zod` 4, and installer `deepmerge` changes: routing and wizards, session persistence, IPFS with the package running, validation during install, and settings surviving a real update are must-runs. The last three have no scripted flow yet, so write them for that PR.

## Scripted flows (these ran on a real node)

| Area | Run | Pass means |
|---|---|---|
| **All pages** | `ui sweep` | Every page and sub-tab visited (about 95), `issues` empty or explained |
| **Package lifecycle** | `ui package-lifecycle` | Installed, restart, pause/resume, config saved, file round trip `identical=true`, logs shown, log download 200, removed; `docker ps -a` shows no Snowflake after |
| **Install by hash or path** | `ui install ref=<hash or path>` | `status: installed`, plus the container on the expected version on the host. On `ui_disconnected`, read the host |
| **Remove with data** | `ui remove-package pkg=<dnp> withData=true` | Containers and `docker volume ls` entries gone |
| **Stakers: apply** | `ui stakers-select minSelected=4` | "Successfully set", clients running, DB value in `maindb.json` |
| **Stakers: switch client** | `ui stakers-select kind=consensus name="Nimbus Hoodi"`, then back | New client's containers up, old ones stopped (`Created`), DB updated, beacon gets its JWT and starts syncing. Then remove the extra client with data. Downloads images and syncs: only on a node cleared for it |
| **Stakers: relay** | `ui stakers-relay-toggle`, twice | Relay added then removed in the MEV Boost container's `RELAYS` env |
| **Notifications: threshold** | `ui notif-threshold max=<input max> value=<n>`, then back | Condition in `config.yaml` changes, then in Gatus's `/api/v1/endpoints/statuses` |
| **Notifications: switch** | `ui notif-toggle title="<row title>"`, twice | `enabled: false`, then `true` in `config.yaml`, Gatus logs "Configuration file has been modified" |
| **Alert: delivery** | `ui pkg-pause-toggle pkg=<client>`, wait for the failure threshold, toggle again | Gatus "Sending initial custom alert", notifier "Received POST /notifications" |
| **Alert: inbox** | Make a condition fail cleanly: restart a client so it has few peers, set its threshold above them, wait 10 × 30 s | Alert text in Notifications > Inbox. Sliders stop at 50 and 100, so this needs a client below that |
| **HTTPS mapping** | `ui https-mapping action=add pkg=<dnp> service=<svc> sub=e2etest port=80 user=e2e pass=<8+ chars, upper, lower, number>`, then the curl checks below, then `action=remove` | API lists it, nginx file appears; 401 without or with wrong auth, 200 with right auth; after removal, files gone and the subdomain doesn't answer |
| **System** | `ui system-checks` | Premium status, auto-updates persist after reload and are restored, auto-diagnose results, ports scanned, `/ping` 200 with a session, dashboard shows live data |
| **Bind** | `host dns-matrix` | Names that resolved before still resolve, `doesnotexist` empty, external names resolve, AAAA, DNSSEC `ad`, TCP and 20 of 20 parallel |
| **Services** | `host services` | HTTPS mappings, Wi-Fi AP, Tailscale state and routes, Premium `valid`, Gatus checks, notifier 200 |
| **Whole node** | `host health`, `host env-snapshot` | Expected versions, restarts 0, same containers running, env diff explained |

HTTPS checks, run from a client on the VPN or Tailscale. `<ip>` is the HTTPS container's `dnprivate_network` address, from `docker inspect`:

```bash
D=$(ssh "$NODE" docker exec DAppNodeCore-https.dnp.dappnode.eth printenv _DAPPNODE_GLOBAL_DOMAIN)
curl -sk -o /dev/null -w '%{http_code}\n' --resolve "e2etest.$D:443:<ip>" "https://e2etest.$D/"                    # 401
curl -sk -o /dev/null -w '%{http_code}\n' -u e2e:<pass> --resolve "e2etest.$D:443:<ip>" "https://e2etest.$D/"      # 200
curl -sk -o /dev/null -w '%{http_version} %{http_code}\n' --http2 "https://pwa.$D/"                                 # 2 200
echo | openssl s_client -connect "<ip>:443" -servername "pwa.$D" 2>/dev/null | openssl x509 -noout -issuer -enddate
```

Don't print `$D` in reports; it identifies the node.

## Ways to check specific things

- **Image matches what was tested:** compare `.Image` IDs from `host health`. Identical IDs mean identical images.
- **Binary contents:** `docker cp` the binary out, then `go version -m <binary>`.
- **Docker from the new image against the host:** `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v /usr/src/dappnode/DNCORE:/usr/src/app/DNCORE:ro <image> sh -c '...'` with `docker version`, `docker compose config -q` for each `DNCORE/docker-compose-*.yml`, `docker compose ls`. These are read-only.
- **Gatus against real data, offline:** copy `config.yaml` and `gatus.db*` (only those) to a temp dir, then run the new image with `--network none -v <dir>:/config`. Endpoints should validate and old results should show in the status API; checks fail only because there's no network.
- **Hotspot with a device:** ask the user to join and open a website. Logs show `AP-STA-CONNECTED` and `EAPOL-4WAY-HS-COMPLETED`, but those don't prove DHCP or internet. A Wi-Fi restart can leave devices disconnected.
- **Tailscale end to end:** `tailscale ping` the client, then load the UI and PWA through both advertised routes from the client. The node ID must stay the same across updates.

## Not scripted yet

These were not exercised, or only partly, so their selectors are unverified. Add a step when a change touches them, and list them under "Not covered" otherwise.

- **Package update preserving settings:** install an older version by hash, set a custom env value, update through the UI, diff env. Needs a small package with two or more versions.
- **Session:** login, logout, session after a reload and after a DAPPMANAGER restart.
- **IPFS package running:** local and remote mode, pinning. Start it from System > Packages first.
- **Setup wizard with changed values**, and the advanced editor.
- **Package backup and restore**, on a package that offers a Backup tab, and the volumes pages.
- **Port mapping edits** in a package's Network tab.
- **VPN:** creating and removing WireGuard and OpenVPN devices; the configs hold keys, so check existence only.
- **Host actions:** reboot, password change, Docker upgrade check. Ask first.
- **Nexus chat and MCP tools** (`packages/dappmanager/src/mcp`), beyond the page loading.
- **UPnP port mapping:** needs a router with UPnP. Test the node's network doesn't have one, so `upnpc -l` only proves "no IGD".
- **arm64 images:** nothing here has run on arm64.
- **Migrations** from much older versions, and mainnet or other staker setups.
