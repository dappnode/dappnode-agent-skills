// Official on-chain hash of a published version. ARGS.pkg: display name (Bind, Https, Dappmanager...), ARGS.version: optional.
// Release notes on GitHub show the prerelease hash, which differs from the published one.
// The explorer's front page lists only the newest packages and has no search, so core packages go straight to their repo page.
const REPOS = {
  Bind: "0xb7e15019b306b9d76068742330e10cdc61bf5006",
  Https: "0x24c0da30d03104db15d8ae6c9357edfcbc09273f",
  Wifi: "0xbb0fe4bcc05d83617ff29219e46a7834be9496d7",
  Tailscale: "0x0c0edf1c03cd88d9e6f41154d3320c67ea081955",
  Notifications: "0x7920e76face3f0a429aa4cfbd2d7cc9160150d06",
  Premium: "0xab1e85818b063c8dc5c678e10a0dafbb0d22ad4f",
  Dappmanager: "0x0c564ca7b948008fb324268d8baedaeb1bd47bce"
};
const p = await ctx.newPage();
try {
  if (REPOS[ARGS.pkg]) {
    await p.goto(`https://dappnode.github.io/explorer/#/repo/${REPOS[ARGS.pkg]}`, { timeout: 60000 });
  } else {
    await p.goto("https://dappnode.github.io/explorer/#/", { timeout: 60000 });
    for (let i = 0; i < 40 && !(await p.getByText(ARGS.pkg, { exact: true }).count()); i++) {
      await p.mouse.wheel(0, 4000);
      await p.waitForTimeout(1500);
    }
    await p.getByText(ARGS.pkg, { exact: true }).first().click({ timeout: 10000 });
  }
  for (let i = 0; i < 20 && (await p.locator("a.external-link").count()) < 1; i++) await p.waitForTimeout(2000);
  const rows = await p.$$eval("table tr", (trs) => trs.slice(1).map((tr) => ({ version: tr.querySelector("td")?.innerText.trim(), date: tr.querySelectorAll("td")[1]?.innerText.split("\n")[0], hash: (tr.querySelector("a.external-link")?.getAttribute("href") || "").replace(/^.*\/ipfs\//, "") })));
  return ARGS.version ? rows.find((r) => r.version === ARGS.version) || { notFound: ARGS.version, latest: rows[0] } : rows.slice(0, 3);
} finally { await p.close(); }
