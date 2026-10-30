// ARGS.action add|remove, ARGS.pkg, ARGS.service, ARGS.sub, ARGS.port (default 80), ARGS.user, ARGS.pass.
// The UI requires a password with 8+ chars, upper, lower and a number. Adding exposes the service: remove it afterwards.
const log = [];
await h.goto(`/packages/my/${ARGS.pkg}/network`, 7000);
const grid = page.locator(".network-mappings .list-grid");
if (ARGS.service) { await page.locator(".network-editor select").first().selectOption(ARGS.service); await page.waitForTimeout(1500); }
if (ARGS.action === "add") {
  await page.getByRole("button", { name: "New mapping" }).click(); await page.waitForTimeout(1500);
  const f = page.locator(".network-mappings form").first();
  await f.locator("input[type=text]").nth(0).fill(ARGS.sub);
  await f.locator("input[type=number]").fill(String(ARGS.port || 80));
  if (ARGS.user) { await f.locator("input[type=text]").nth(1).fill(ARGS.user); await f.locator("input[type=password]").fill(ARGS.pass); }
  await f.getByRole("button", { name: "Add mapping" }).click();
} else {
  // The last svg in the grid is the remove icon; the svg between container and subdomain is only an arrow.
  await grid.locator("> svg").last().click();
}
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(2000); await h.settleDialogs(log);
  const has = new RegExp(ARGS.sub).test(await grid.innerText().catch(() => ""));
  if (has === (ARGS.action === "add")) { log.push(`${ARGS.action} done`); break; }
  const e = (await page.locator("body").innerText()).match(/Error[^\n]{0,160}/); if (e) { log.push(e[0]); break; }
}
return { log, events: h.relevant() };
