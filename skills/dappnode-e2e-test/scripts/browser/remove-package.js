// ARGS.pkg (e.g. nimbus-hoodi.dnp.dappnode.eth), ARGS.withData=true to pick "Remove and delete data".
const log = [];
await h.goto(`/packages/my/${ARGS.pkg}/info`, 6000);
await page.locator("strong", { hasText: /^Remove$/ }).locator("xpath=ancestor::*[.//button][1]").locator("button").first().click();
await page.waitForTimeout(2000);
const dlg = page.locator("#light-dialog");
if (/Removal warning/.test(await dlg.innerText())) { log.push("stakers removal warning -> Continue"); await dlg.locator("button", { hasText: /^Continue$/ }).click(); await page.waitForTimeout(2000); }
log.push("options: " + (await dlg.locator("button").allInnerTexts()).join(" | "));
const label = ARGS.withData === "true" ? /^Remove and delete data$/ : /^Remove$/;
await dlg.locator("button", { hasText: label }).click();
for (let i = 0; i < 60; i++) { await page.waitForTimeout(2000); const m = (await page.locator("body").innerText()).match(/Removed [^\n]*|Error[^\n]{0,150}/); if (m) { log.push(m[0]); break; } }
return { log, url: page.url(), events: h.relevant() };
