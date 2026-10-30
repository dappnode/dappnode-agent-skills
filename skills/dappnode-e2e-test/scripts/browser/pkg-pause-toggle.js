// Clicks the first row's pause/resume icon. ARGS.pkg e.g. hoodi-reth.dnp.dappnode.eth. The first row is "All containers" on multi-service packages.
await h.goto(`/packages/my/${ARGS.pkg}/info`, 5000);
await page.locator(".list-grid.containers > svg").nth(0).click();
await page.waitForTimeout(1500);
const log = await h.settleDialogs([]);
await page.waitForTimeout(12000);
return { state: (await page.locator(".list-grid.containers .state-badge").allInnerTexts()).join(","), log };
