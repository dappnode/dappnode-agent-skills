// Flips one MEV-Boost relay and applies. ARGS.network (default hoodi), ARGS.relay (default Titan). Run twice to restore.
const log = []; const network = ARGS.network || "hoodi"; const relay = ARGS.relay || "Titan";
for (let i = 0; i < 8; i++) { await h.goto(`/stakers/${network}`, 15000); if ((await page.$$eval(".mev-boost.isSelected", (e) => e.length)) > 0) break; log.push("MEV Boost not shown as selected yet (needs RPC and running clients), retrying"); }
const cb = page.locator(".mev-boost tr", { hasText: relay }).locator("input[type=checkbox]");
await cb.click(); log.push(`${relay} -> ${await cb.isChecked()}`);
await page.getByRole("button", { name: "Apply changes" }).click();
for (let i = 0; i < 80; i++) {
  await page.waitForTimeout(3000); await h.settleDialogs(log);
  const b = await page.locator("body").innerText();
  if (/Successfully set new staker configuration/.test(b)) { log.push("applied"); break; }
  const e = b.match(/Error setting new staker configuration[^\n]*/); if (e) { log.push(e[0]); break; }
}
return { log };
