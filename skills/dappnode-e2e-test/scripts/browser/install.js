// ARGS.ref: an IPFS hash (Qm...) or an installer path (/installer/dnp/<name>). ARGS.maxSeconds default 300.
// Returns instead of waiting when dappmanager rejects the install or the UI disconnects, so a run never
// sits silently: on "ui_disconnected" or "timeout" read the real result from the host.
events.length = 0;
const log = []; const t0 = Date.now(); const ts = () => `${((Date.now() - t0) / 1000) | 0}s`;
const limit = Number(ARGS.maxSeconds || 300) * 1000;
const url = ARGS.ref.startsWith("/") ? UI + ARGS.ref : `${UI}/installer/public/%2Fipfs%2F${ARGS.ref}`;
const installBtn = () => page.getByRole("button", { name: /^(INSTALL|UPDATE)$/i });

// 1. Load the install page, retrying while the IPFS gateways are slow
let ready = false;
for (let attempt = 1; attempt <= 6 && !ready && Date.now() - t0 < limit; attempt++) {
  await page.goto(url).catch(() => {});
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(3000);
    await h.assertLoggedIn();
    if (await installBtn().count()) { ready = true; break; }
    const err = (await h.flatText()).match(/(All IPFS gateways failed[^.]{0,120}|Error[^.]{0,160}|not found[^.]{0,80}|Could not[^.]{0,120})/i);
    if (err) { log.push(`${ts()} attempt ${attempt}: ${err[0].slice(0, 160)}`); break; }
  }
  if (!ready) await page.waitForTimeout(8000);
}
if (!ready) {
  const t = await h.flatText();
  return { status: /UPDATED/.test(t) ? "already_updated_button_disabled" : "page_not_ready", log, tail: t.slice(-300) };
}
const info = await h.flatText();
log.push(`${ts()} page ready: ${(info.match(/SIZE \S+ \S+/) || [""])[0]} ${(info.match(/VERSION \S+/) || [""])[0]} ${/Not signed/.test(info) ? "NOT SIGNED" : /Signed/.test(info) ? "signed" : ""}`);

// 2. Prereleases are unsigned and core: tick the bypass options when offered
for (const name of ["Bypass core restriction", "Bypass only signed safe restriction"]) {
  let sw = page.locator(`input[id="switch-${name}"]`);
  if (!(await sw.count())) { await page.getByText(/^advanced options$/i).first().click().catch(() => {}); await page.waitForTimeout(1000); sw = page.locator(`input[id="switch-${name}"]`); }
  if (!(await sw.count())) { log.push(`${name}: not offered`); continue; }
  if (!(await sw.isChecked())) { await page.locator(`label[for="switch-${name}"]`).click().catch(() => {}); await page.waitForTimeout(500); }
  if (!(await sw.isChecked())) { await sw.click({ force: true }).catch(() => {}); await page.waitForTimeout(500); }
  if (!(await sw.isChecked())) return { status: "bypass_not_enabled", name, log };
  log.push(`${name}: on`);
}

// 3. Install, stepping through the wizard (Setup, Permissions, Warnings, Disclaimer, Notifications)
await installBtn().first().click();
log.push(`${ts()} clicked install`);
let last = "";
while (Date.now() - t0 < limit) {
  await page.waitForTimeout(3000);
  for (const name of ["Accept", "Next", "Submit"]) {
    const b = page.locator("main, #root").first().getByRole("button", { name, exact: true });
    if ((await b.count().catch(() => 0)) && (await b.first().isVisible().catch(() => false)) && (await b.first().isEnabled().catch(() => false))) {
      log.push(`${ts()} wizard ${page.url().split("/").pop().slice(0, 24)} -> ${name}`);
      await b.first().click().catch(() => {});
      break;
    }
  }
  await h.settleDialogs(log);
  const body = await h.body();
  const m = body.match(/(untrusted origin and is not signed|can only be installed as signed|Successfully installed|Installed [A-Z][a-z]+|Installing [A-Z][a-z]+|Loading image|Starting download|Downloading \d+%)/);
  if (m && m[0] !== last) { log.push(`${ts()} ${m[0]}`); last = m[0]; }
  if (/untrusted origin|only be installed as signed/.test(last)) return { status: "rejected", reason: last, log };
  if (/Successfully installed|^Installed /.test(last) || /\/packages\/(my|system)\//.test(page.url())) {
    await page.waitForTimeout(3000); await h.settleDialogs(log);
    return { status: "installed", log, events: h.relevant() };
  }
  if (/SocketIO connection closed/.test(JSON.stringify(events))) return { status: "ui_disconnected", note: "expected when dappmanager or the tunnel the browser uses restarts: check the host", log };
}
return { status: "timeout", note: "check the host", log, events: h.relevant() };
