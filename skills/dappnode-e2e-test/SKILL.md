---
name: dappnode-e2e-test
description: Deeply test a Dappnode end to end on a real test node, through the real admin UI and on the host, and report whether a change is safe to merge or publish. Use this whenever someone wants confidence in a big or risky change to DAPPMANAGER or a core package, including dependency or Node/Go/base-image bumps, PRs touching many packages, prereleases, DNP_CORE releases, core update or downgrade checks, or asks to "test this on my node", "deep test", "regression test", "smoke test the dappnode", "is this safe to merge" or "is this ready to publish", even if they don't say end to end. Not for writing or fixing unit tests alone.
---

# Dappnode end-to-end testing

Unit tests pass while Dappnode breaks, because the risky parts are the seams: Docker and Compose versions against the host daemon, the installer rewriting DNCORE files, sessions, DNS, IPFS, nginx and packages talking to each other. This skill exercises those seams on a real node, compares against a baseline taken first, and reports what was and wasn't covered.

A result is only useful if it is honest about its limits. "Everything passes" must mean each listed flow ran and its effect was checked on the host, not just that the UI showed a success message.

## Ground rules

- **Test node only.** Get the node from the user or from memory, never guess it. Confirm it is a spare node before the first change, and look at what is running on it: nodes change between sessions. Read-only checks are fine; anything else on a node you haven't been cleared to change needs asking first.
- **Secrets stay out of output.** Env values, license keys, Wi-Fi passwords and VPN configs go through fingerprints (`env-snapshot.sh`, `services.sh`). Don't print raw logs from containers that hold secrets; filter them to the lines you need and scrub. Don't download WireGuard/OpenVPN device configs. Gatus shares a volume with the notifier's push keys, so copy individual files out of it, never the whole directory.
- **Ask first:** reboot, power off, host or UI password changes, Docker upgrades, and anything touching validator keys. A real Premium license must not be tested with a dummy key: failed activation overwrites the stored license.
- **Tell the user what you accepted on their behalf.** The flows click through disclaimers and Terms of Use, and `settleDialogs` logs each one. Include them in the report.
- **Stay visibly alive.** The user reads a silent long-running command as stuck, and is often right. Use short foreground commands or a background task plus host checks, and report as you go. If the user interrupts because a wizard stalled, fix the helper, don't just rerun it.
- **Restore what you change:** thresholds, relays, mappings, test packages, image tags.

## Workflow

### 1. Scope from the diff

Read the PR's description, changed files and major dependency bumps, then use the diff-to-test map in [references/test-matrix.md](references/test-matrix.md). Send the user a short plan: what will run, what the diff makes high risk, and which of those risks have no scripted flow yet. Write a flow for the gaps instead of skipping them silently.

### 2. Static checks

In a checkout of the repo under test, using the Node version from its `Dockerfile` (`nvm install <version>`):

```bash
yarn install --immutable && yarn build && yarn lint
for p in packages/*/; do grep -q '"test"' "$p/package.json" && (cd "$p" && yarn test >"/tmp/$(basename "$p").log" 2>&1; echo "$(basename "$p") rc=$?"); done
```

Loop over the packages: root `yarn test` stops at the first failure and hides the rest. `dockerApi` network tests and `utils` `getPublicIpFromUrls` have short timeouts and real network calls; rerun them and compare with the base branch before calling a failure real.

### 3. Baseline the node, before any change

Without this, a later failure can't be attributed to the change. Save these outputs (paths below are relative to this skill):

```bash
ssh "$NODE" 'bash -s' < scripts/host/health.sh       > before-health.txt
ssh "$NODE" 'bash -s' < scripts/host/services.sh     > before-services.txt
ssh "$NODE" 'bash -s' < scripts/host/env-snapshot.sh > before-env.txt
ssh "$NODE" 'bash -s' < scripts/host/dns-matrix.sh   > before-dns.txt
```

Check the starting point too. A client that is still syncing or an IPFS package that is stopped changes what can be tested and what the errors mean; note it in the report.

### 4. Open the browser controller

It drives the installed Chrome with its own profile, kept in `~/.cache/dappnode-e2e`, so the login survives between runs and the user's own browser isn't touched.

```bash
scripts/browser/start.sh                       # run as a background task
scripts/browser/ui.sh scripts/browser/sweep.js # each step prints JSON
scripts/browser/stop.sh                        # when finished
```

`NOT_LOGGED_IN` means the user has to log in once in the window that opened. Never ask for the password. Steps accept `KEY=VALUE` arguments, and one-off steps can be piped: `printf '...' | scripts/browser/ui.sh -`. Steps get `page ctx events fs dir UI h ARGS`; see `h` in `daemon.mjs`.

If `my.dappnode` isn't reachable, the Mac's VPN or Tailscale is probably off. As a fallback use `ssh -N -L 18080:172.33.1.7:80 "$NODE"` with `DAPPNODE_UI=http://localhost:18080`; that needs its own login.

### 5. Deploy the change

Follow [references/deploy-and-rollback.md](references/deploy-and-rollback.md). A prerelease installed through the UI is the most realistic. Start the install monitor first for core packages or DNP_CORE:

```bash
ssh "$NODE" 'bash -s' -- start   < scripts/host/monitor.sh
ssh "$NODE" 'bash -s' -- summary < scripts/host/monitor.sh   # after: resolved versions, changes, errors
ssh "$NODE" 'bash -s' -- stop    < scripts/host/monitor.sh
```

For a DNP_CORE release, compare its manifest with the previous release and with the versions published on-chain before anyone installs it, and check the set in `Resolved request` matches. Confirm packages that should not change really didn't.

### 6. Run the matrix

Run every flow in [references/test-matrix.md](references/test-matrix.md) that the scope calls for, and check each effect on the host. A success toast isn't evidence; the container env, DNCORE file or Gatus state is.

### 7. Judge every failure before reporting it

Most errors seen on a real node are not caused by the change. Before calling one a regression:

1. Check [references/gotchas.md](references/gotchas.md), which lists known noise and existing behaviour.
2. Read the code path. Several "failures" in the past were intended behaviour.
3. Compare with the old version, in the same conditions and interleaved (new, old, new, old), because home networks drift. Old and new images can run side by side as throwaway containers with `--network none` or on `dncore_network`.
4. Rule out the network with `curl` and `ping` from the host. Packet loss on the uplink can look like a Node or RPC bug.

Report a pre-existing bug as pre-existing, with the evidence, even when it looks bad. An empty comparison isn't a pass: if a diff of two outputs is "identical", check they aren't both empty.

### 8. Restore and report

Remove test packages and mappings, revert settings, rerun the baseline scripts and diff them. Then leave the node in the state the user wants, and say what's left behind.

## Report

Lead with the verdict and what it depends on, then:

- **Tested:** a table of area, what ran, result. Include versions and, for releases, whether image IDs match what was tested.
- **Settings and data:** before/after diff of env fingerprints, license, Gatus history.
- **Found:** each issue marked as regression or pre-existing, with evidence.
- **Not covered:** always present. At minimum consider arm64, upgrades from older versions, other networks and staker setups, UPnP, and anything in the matrix that didn't run.
- **Left on the node** and **accepted on the user's behalf**.

If the repo under test is public and the change is sensitive, ask how the user wants it described before writing PR text.
