// Flips one check in Notifications > Settings. ARGS.title is the row title. Run twice to restore.
await h.goto("/notifications/settings", 8000);
const row = page.locator(".endpoint-row", { hasText: ARGS.title });
await row.locator("label").first().click();
await page.waitForTimeout(1000);
return { checked: await row.locator("input").first().isChecked() };
