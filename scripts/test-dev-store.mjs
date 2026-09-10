// Run against the real dev server: node scripts/test-dev-store.mjs <URL including /optio/>
// Requires Playwright Chromium, or CHROMIUM_PATH pointing to an installed Chromium.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2];
assert.ok(url, "Pass the dev app URL (including /optio/)");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  // Isolate OPFS and workers from existing user data. Mocks miss dev RPC module mismatches.
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto(`${url}#/templates`);
  const names = ["Assembly line", "Ward round", "Warehouse pick"];
  for (const name of names) {
    await page.getByRole("button", { name: `Open ${name}`, exact: true }).waitFor();
  }

  // Remove one seeded template so this tests a real Add operation, not its no-op path.
  await page.getByRole("button", { name: 'Actions for "Ward round"', exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Ward round", exact: true })
    .waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Add sample templates", exact: true }).click();
  await page.getByRole("button", { name: "Open Ward round", exact: true }).waitFor();
  await page.getByRole("button", { name: "Add sample templates", exact: true }).click();
  await page.reload();
  for (const name of names) {
    const row = page.getByRole("button", { name: `Open ${name}`, exact: true });
    await row.waitFor();
    assert.equal(await row.count(), 1, `${name} must persist without duplicates`);
  }
  console.log(
    "PASS: fresh store seeded, missing sample restored, reload persisted three templates",
  );
  await context.close();
} finally {
  await browser.close();
}
