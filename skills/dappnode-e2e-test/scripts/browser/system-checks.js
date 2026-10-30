// Premium status, auto-update persistence (restored afterwards), auto-diagnose, port scan, dashboard.
const R = {};
await h.goto("/premium/activate", 7000);
R.premium = (await h.flatText()).match(/DEACTIVATED|ACTIVATED/)?.[0];
await h.goto("/system/auto-updates", 6000);
const sw = () => page.locator(".auto-updates-default-setting", { hasText: "My packages" });
const b0 = await sw().locator("input").isChecked();
await sw().locator("label").click(); await page.waitForTimeout(4000); await page.reload(); await page.waitForTimeout(6000);
const b1 = await sw().locator("input").isChecked();
await sw().locator("label").click(); await page.waitForTimeout(4000); await page.reload(); await page.waitForTimeout(6000);
R.autoUpdates = `before=${b0} toggled+reload=${b1} restored+reload=${await sw().locator("input").isChecked()}`;
await h.goto("/support/auto-diagnose", 12000);
R.autoDiagnose = (await h.lines()).filter((l) => /resolves|internet|ports|loopback|Disk usage|not running/i.test(l) && l.length < 110);
await h.goto("/support/ports", 5000);
const scan = page.getByRole("button", { name: /API Scan/i }).first();
if (await scan.count()) { await scan.click(); await page.waitForTimeout(25000); }
R.portsScanned = (await h.lines()).filter((l) => /^\d+\s+(TCP|UDP)/.test(l)).length;
const ping = await page.request.get(`${UI}/ping`); R.adminPing = ping.status();
await h.goto("/dashboard", 8000);
R.dashboard = ((await h.flatText()).match(/SYSTEM HEALTH.{0,300}/)?.[0] || "").slice(0, 300);
return R;
