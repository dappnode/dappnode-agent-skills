// Keeps one visible Chrome open so a human can log in once, then runs JS steps sent by ui.sh.
// Copied into the state dir by setup.sh so that it resolves the playwright installed there.
import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname) + "/";
const UI = (process.env.DAPPNODE_UI || "http://my.dappnode").replace(/\/$/, "");
const PORT = Number(process.env.E2E_PORT || 9333);

// This server evaluates code. Without the token any web page could POST to it, because a
// plain text POST to localhost needs no CORS preflight; a custom header forces one.
const token = crypto.randomBytes(24).toString("hex");
fs.writeFileSync(dir + "token", token, { mode: 0o600 });
fs.writeFileSync(dir + "daemon.pid", String(process.pid));
fs.mkdirSync(dir + "shots", { recursive: true });

const ctx = await chromium.launchPersistentContext(dir + "profile", {
  channel: "chrome", // the installed Chrome, separate profile: the user's own profile is untouched
  headless: false,
  viewport: { width: 1400, height: 900 }
});
const page = ctx.pages()[0] || (await ctx.newPage());

const events = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) events.push({ t: Date.now(), kind: "console." + m.type(), text: m.text().slice(0, 400) });
});
page.on("pageerror", (e) => events.push({ t: Date.now(), kind: "pageerror", text: String(e).slice(0, 400) }));
page.on("requestfailed", (r) => events.push({ t: Date.now(), kind: "requestfailed", text: `${r.method()} ${r.url()} ${r.failure()?.errorText}` }));
page.on("response", (r) => {
  if (r.status() >= 400) events.push({ t: Date.now(), kind: "http" + r.status(), text: `${r.request().method()} ${r.url()}` });
});

// Noise present on every node; see references/gotchas.md before adding to this list.
const NOISE = /Service Worker|avatar\/ipfs|ipfs\.dappnode:5001|ERR_NAME_NOT_RESOLVED|status of 502/;

const h = {
  flatText: async () => (await page.locator("main, #root").first().innerText().catch(() => "")).replace(/\s+/g, " "),
  lines: async () => (await page.locator("main, #root").first().innerText().catch(() => "")).split("\n").filter(Boolean),
  body: async () => (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " "),
  assertLoggedIn: async () => {
    if (/Login Username/.test(await h.body())) throw Error("NOT_LOGGED_IN: ask the user to log in in the open Chrome window");
  },
  goto: async (p, ms = 5000) => {
    await page.goto(UI + p);
    await page.waitForTimeout(ms);
    await h.assertLoggedIn();
  },
  relevant: (from = 0) => events.slice(from).filter((e) => !NOISE.test(e.text)).map((e) => `${e.kind}: ${e.text.slice(0, 200)}`),
  shot: (name) => page.screenshot({ path: `${dir}shots/${name}.png`, fullPage: true }).catch(() => {}),
  // Confirms whatever dialog is open and records its text, so the report can list what was accepted.
  // Exception: the auto-update prompt is declined, because the test must not change user settings.
  settleDialogs: async (log = []) => {
    for (const sel of ["#light-dialog .confirm-dialog-root", ".modal.show"]) {
      if (!(await page.locator(sel).count().catch(() => 0))) continue;
      const txt = (await page.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 120);
      if (/enable auto-update/i.test(txt)) {
        await page.locator(sel + " button", { hasText: /^cancel$/i }).first().click().catch(() => {});
        log.push(`dialog "${txt.slice(0, 50)}" -> Cancel`);
        continue;
      }
      const boxes = page.locator(sel + " input[type=checkbox]");
      for (let i = 0; i < (await boxes.count().catch(() => 0)); i++) await boxes.nth(i).check().catch(() => {});
      const btns = page.locator(sel + " button:not([disabled])").filter({ hasNotText: /^(cancel|close|×|)$/i });
      if (await btns.count().catch(() => 0)) {
        const label = (await btns.last().innerText().catch(() => "")).trim();
        await btns.last().click().catch(() => {});
        log.push(`dialog "${txt}" -> ${label}`);
      }
    }
    return log;
  }
};

await page.goto(UI).catch((e) => console.error("UI not reachable yet:", String(e).slice(0, 200)));

const server = http.createServer(async (req, res) => {
  if (req.headers["x-e2e-token"] !== token) {
    res.statusCode = 401;
    return res.end("{}");
  }
  let body = "";
  for await (const c of req) body += c;
  try {
    const fn = new Function("page", "ctx", "events", "fs", "dir", "UI", "h", `return (async () => { ${body}\n})()`);
    res.end(JSON.stringify({ ok: true, out: await fn(page, ctx, events, fs, dir, UI, h) }, null, 1));
  } catch (e) {
    res.end(JSON.stringify({ ok: false, error: String(e).slice(0, 2000) }));
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`daemon ready on ${PORT}, UI ${UI}`));

const stop = async () => {
  await ctx.close().catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
