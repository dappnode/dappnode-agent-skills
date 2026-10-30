// Select a client and apply. ARGS.network (default hoodi), ARGS.kind (execution|consensus), ARGS.name: card
// text such as "Nimbus Hoodi". Without kind it re-applies the current selection after reselecting nothing.
const log = []; const network = ARGS.network || "hoodi";
for (let i = 0; i < 8; i++) {
  await h.goto(`/stakers/${network}`, 15000);
  const n = await page.$$eval(".isSelected", (els) => els.length);
  log.push("selected: " + (await page.$$eval(".isSelected", (els) => els.map((e) => e.innerText.split("\n")[0]))).join(", "));
  if (n >= Number(ARGS.minSelected || 1)) break;
}
if (ARGS.kind) { await page.locator(`.${ARGS.kind}-client`, { hasText: ARGS.name }).click(); log.push("clicked " + ARGS.name); await page.waitForTimeout(1000); }
await page.getByRole("button", { name: "Apply changes" }).click();
for (let i = 0; i < 180; i++) {
  await page.waitForTimeout(3000); await h.settleDialogs(log);
  const b = await page.locator("body").innerText();
  if (/Successfully set new staker configuration/.test(b)) { log.push(`applied after ~${i * 3}s`); break; }
  const e = b.match(/Error setting new staker configuration[^\n]*/); if (e) { log.push(e[0]); break; }
}
return { log, events: h.relevant() };
