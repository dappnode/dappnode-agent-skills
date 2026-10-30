// Install -> restart -> pause/resume -> config -> file round trip -> logs -> remove, on Snowflake:
// small, no chain sync, no volumes, and one env var. Its image has no /tmp and no shell, so files go to /etc.
const log = []; const t0 = Date.now(); const ts = () => `${((Date.now() - t0) / 1000) | 0}s`;
const { createHash } = await import("node:crypto");
const dnp = "snowflake.public.dappnode.eth";
const container = "DAppNodePackage-snowflake-proxy.snowflake.public.dappnode.eth";
const sha = (b) => createHash("sha256").update(b).digest("hex");
events.length = 0;

let ok = false;
for (let a = 0; a < 6 && !ok; a++) {
  await h.goto(`/installer/dnp/${dnp}`, 1000);
  for (let i = 0; i < 15 && !ok; i++) { await page.waitForTimeout(3000); ok = (await page.getByRole("button", { name: "INSTALL" }).count()) > 0; }
  if (!ok) log.push(`${ts()} install page not ready (attempt ${a + 1})`);
}
if (!ok) return { failed: "install page never loaded (is it already installed?)", log };
await page.getByRole("button", { name: "INSTALL" }).click();
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(3000);
  const a = page.locator("main, #root").first().getByRole("button", { name: "Accept", exact: true });
  if ((await a.count()) && (await a.first().isVisible())) { await a.first().click(); continue; }
  await h.settleDialogs(log);
  if (/\/packages\/my\/snowflake/.test(page.url())) { log.push(`${ts()} installed`); break; }
}
await page.waitForTimeout(3000); await h.settleDialogs(log);
const state = () => page.locator(".list-grid.containers .state-badge").first().innerText().catch(() => "?");
// Row icons: 0 = pause/resume, 1 = restart. The "Pause"/"Restart" texts are only column headers.
const icon = async (n) => { await page.locator(".list-grid.containers > svg").nth(n).click(); await page.waitForTimeout(1500); await h.settleDialogs(log); await page.waitForTimeout(8000); };
log.push("state: " + (await state()));
await icon(1); log.push("after restart: " + (await state()));
await icon(0); log.push("after pause: " + (await state()) + " (Snowflake exits 2 on SIGTERM, so CRASHED is expected here)");
await icon(0); log.push("after resume: " + (await state()));

await h.goto(`/packages/my/${dnp}/config`, 4000);
await page.locator("input[placeholder='enter value...']").first().fill("-verbose");
await page.getByRole("button", { name: "Update", exact: true }).click();
await page.waitForTimeout(1500); await h.settleDialogs(log);
let updated = false;
for (let i = 0; i < 15 && !updated; i++) { await page.waitForTimeout(2000); updated = /Updated Snowflake/.test(await page.locator("body").innerText()); }
log.push(`config saved: ${updated}`);

// 200 KB: the file manager sends the file as one Socket.IO message, limited to 1 MB after base64.
const file = dir + "upload-test.bin";
fs.writeFileSync(file, (await import("node:crypto")).randomBytes(204800));
await h.goto(`/packages/my/${dnp}/file-manager`, 3000);
await page.locator("input[type=file]").setInputFiles(file);
await page.locator("input[placeholder='Defaults to $WORKDIR/']").fill("/etc/");
await page.getByRole("button", { name: "Upload", exact: true }).click();
await page.waitForTimeout(6000);
const dl = await page.request.get(`${UI}/file-download/${container}/?path=/etc/upload-test.bin`);
const buf = await dl.body();
log.push(`file round trip: HTTP ${dl.status()} ${buf.length}B identical=${sha(buf) === sha(fs.readFileSync(file))}`);
fs.unlinkSync(file);

await h.goto(`/packages/my/${dnp}/logs`, 5000);
log.push("log lines shown: " + (await h.lines()).filter((l) => /\d{4}\/\d\d\/\d\d/.test(l)).length);
const cl = await page.request.get(`${UI}/container-logs/${container}`);
log.push(`log download: HTTP ${cl.status()} ${(await cl.body()).length}B`);

await h.goto(`/packages/my/${dnp}/info`, 4000);
await page.locator("strong", { hasText: /^Remove$/ }).locator("xpath=ancestor::*[.//button][1]").locator("button").first().click();
await page.waitForTimeout(1500);
await page.locator("#light-dialog button", { hasText: /^Remove$/ }).click();
let removed = false;
for (let i = 0; i < 20 && !removed; i++) { await page.waitForTimeout(2000); removed = /Removed Snowflake/.test(await page.locator("body").innerText()); }
log.push(`${ts()} removed: ${removed}`);
return { log, events: h.relevant() };
