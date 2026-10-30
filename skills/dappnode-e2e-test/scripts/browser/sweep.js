// Visits every main page and sub-tab; reports console errors, failed requests and error text.
await h.goto("/dashboard", 3000);
const start = events.length;
const queue = ["/dashboard", "/wireless-network/wifi", "/vpn/tailscale", "/installer/dnp", "/packages/my", "/packages/system", "/stakers/ethereum", "/stakers/hoodi", "/system/info", "/notifications/inbox", "/community", "/sdk", "/support/auto-diagnose", "/nexus", "/premium/activate", "/system/profile"];
const seen = new Set(); const issues = [];
const max = Number(ARGS.maxPages || 120);
const errRe = /(error|failed|cannot|unable|exception|something went wrong)/i;
// Log text shown by the package pages, and form hints: not page failures.
const textNoise = /Send usage data|developer asks|Execution engine call failed|Unsupported fork|No changes detected|Invalid Ethereum RPC url|Error count: 0|TPM: error|tailscale0|ip-forwarding|warming-up/;
while (queue.length && seen.size < max) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const before = events.length;
  await page.goto(UI + path).catch((e) => events.push({ kind: "goto", text: String(e) }));
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const uiErrors = (await h.lines()).filter((l) => errRe.test(l) && l.length < 200 && !textNoise.test(l)).slice(0, 4);
  const segs = path.split("/").filter(Boolean);
  const base = "/" + segs.slice(0, /^\/packages\/(my|system)\//.test(path) ? 3 : 1).join("/");
  const subs = await page.$$eval("a[href]", (as, b) => as.map((a) => a.getAttribute("href")).filter((x) => x && x.startsWith(b + "/") && !x.includes("#")), base);
  for (const s of subs) if (!seen.has(s) && !queue.includes(s)) queue.push(s);
  const ev = h.relevant(before);
  if (uiErrors.length || ev.length) { issues.push({ path, uiErrors, events: ev.slice(0, 3) }); await h.shot("sweep" + path.replace(/\W/g, "_")); }
}
return { visited: seen.size, leftInQueue: queue.length, issues, totalEvents: events.length - start };
