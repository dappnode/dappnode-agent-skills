# Deploy and roll back

## Which way to deploy

1. **Prerelease through the UI:** closest to what users do, and it goes through the real installer. Use it when CI has published a GitHub prerelease.
2. **Image built from a branch, swapped in:** for a PR without a release. It doesn't exercise the installer, and leaves the node on a tag that needs restoring.
3. **Published release or DNP_CORE:** install through the UI, with the monitor running.

## Prerelease through the UI

```bash
scripts/browser/ui.sh scripts/browser/install.js ref=<ipfs hash from the release notes>
```

- The page is `my.dappnode/installer/public/%2Fipfs%2F<hash>`.
- Unsigned core prereleases need **Bypass core restriction** and **Bypass only signed safe restriction** under Advanced options, or the install is rejected with "from untrusted origin and is not signed". `install.js` ticks them when offered.
- The wizard is part of the page, not a dialog, and differs per package: Setup, Permissions, Warnings, Disclaimer, Notifications. Setup is prefilled with current values, so submitting it keeps them. Check that with `env-snapshot.sh`.
- **Premium can only be installed signed.** It's hard-coded in `packageInstall`, with no bypass. To test an unsigned Premium build, load its image and start it with a compose override (below).
- Install order: DAPPMANAGER first, so the new one installs the rest, then Bind, whose DNS everything depends on, then the others. After Bind, run `dns-matrix.sh` before continuing.

**DAPPMANAGER or the VPN path restarting drops the browser**, so `install.js` returns `ui_disconnected`. The install continues server side. Read the result on the host, not in the page:

```bash
docker inspect DAppNodeCore-dappmanager.dnp.dappnode.eth --format '{{.Config.Image}} {{.State.StartedAt}}'
docker logs --since 5m DAppNodeCore-dappmanager.dnp.dappnode.eth 2>&1 | grep -E 'RPC (success|error) packageInstall'
```

If the browser reaches the node through Tailscale, updating Tailscale cuts it too. SSH over the LAN keeps working.

## Image from a branch

```bash
# DAPPMANAGER's Dockerfile copies .git and runs git rev-parse, so it needs a real clone, not a worktree or an archive.
git bundle create /tmp/pr.bundle origin/develop..<branch>
scp /tmp/pr.bundle "$NODE":/tmp/
ssh "$NODE" 'git clone -q --branch develop https://github.com/dappnode/DNP_DAPPMANAGER.git ~/e2e-src && cd ~/e2e-src \
  && git fetch -q /tmp/pr.bundle <branch>:<branch> && git checkout -q <branch> && docker build -t dappmanager:e2e . > ~/e2e-build.log 2>&1; echo exit $?'
```

Private core repos can't be cloned on the host: `git archive HEAD | ssh "$NODE" 'mkdir -p ~/e2e-src && tar -x -C ~/e2e-src'`, then build. Docker Desktop on a Mac may fail `yarn install` with connection errors under load that a real node doesn't have, so build on the node.

Before swapping, run the read-only checks from "Ways to check specific things" in the test matrix against the new image, and boot it once with `--network none` and no Docker socket to catch startup crashes.

**Swap.** DAPPMANAGER derives a package's version from the image tag when there's no label. So the app stays on a consistent version if the test image takes the deployed tag:

```bash
cd /usr/src/dappnode/DNCORE
docker tag dappmanager.dnp.dappnode.eth:<v> dappmanager.dnp.dappnode.eth:<v>-backup
docker tag dappmanager:e2e dappmanager.dnp.dappnode.eth:<v>
docker compose -p dncore -f docker-compose-dappmanager.yml up -d --no-deps --no-build dappmanager.dnp.dappnode.eth
```

The `dncore` project spans several files, so an orphan warning is normal. Never pass `--remove-orphans`. Service names: `premium`, `notifier`, `gatus`, others per the file.

Alternatively, leave tags alone and use an override file, which keeps the real version visible and needs no retagging:

```bash
printf 'services:\n  premium:\n    image: premium.premium.dnp.dappnode.eth:<new>\n' > ~/override.yml
docker compose -p dncore -f docker-compose-premium.yml -f ~/override.yml up -d --no-deps --no-build premium
```

The DNCORE file still names the old version, so any core restart or update goes back to it.

**Tags left behind cause real problems.** The installer reuses a local image with a matching tag instead of downloading ("Starting package" with no download), so a test build under an official tag can silently stay in use. It also deletes previous images when updating, including `-backup` tags. Before any later install, remove your test tags and confirm image IDs.

## Rolling back

```bash
# With the backup still there:
docker tag <image>:<v>-backup <image>:<v>
docker compose -p dncore -f docker-compose-<pkg>.yml up -d --no-deps --no-build <service>
```

**Downgrading a released version** goes through the UI, using the official hash:

```bash
scripts/browser/ui.sh scripts/browser/explorer-hash.js pkg=Bind version=0.2.13
scripts/browser/ui.sh scripts/browser/install.js ref=<hash>
```

- Take the hash from the explorer (https://dappnode.github.io/explorer/#/), which reads the chain. Release notes show the prerelease hash, and publishing changes it.
- Requesting an older version by name can't work. `?version=` shows a disabled "UPDATED" button, and both resolvers drop any request that isn't newer, even with `BYPASS_RESOLVER`. A hash isn't valid semver, so `shouldUpdate()` lets it through.
- Do DAPPMANAGER **last**, since it does the installing.
- Published releases are signed, so Premium installs normally.

Afterwards compare `health.sh`, `env-snapshot.sh` and `services.sh` with the baseline. A new env var that comes from the old manifest is fine; explain it.

## Cleanup

Remove from the node when done: `~/e2e-src`, override files, test image tags, `~/e2e-monitor` if not needed. Run `scripts/browser/stop.sh` on the client.
