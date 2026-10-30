// Moves a threshold slider in Notifications > Settings. ARGS.max identifies it (input max, e.g. 50 or 100), ARGS.value is the new value.
await h.goto("/notifications/settings", 8000);
const s = page.locator(`input.slider-component[max='${ARGS.max}']`);
const before = await s.first().inputValue();
await s.first().fill(String(ARGS.value));
await s.first().dispatchEvent("change"); await s.first().dispatchEvent("mouseup");
await page.waitForTimeout(2000);
return { before, label: await page.locator(".slider-container", { has: s.first() }).locator(".slider-value").innerText() };
