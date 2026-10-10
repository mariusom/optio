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
  // Template rows are named by their visible text: title, question counts and badge.
  const templateRow = (name) => page.getByRole("button", { name: new RegExp(`^${name} \\d`) });
  for (const name of names) {
    await templateRow(name).waitFor();
  }

  // Remove one seeded template so this tests a real Add operation, not its no-op path.
  await page.getByRole("button", { name: 'Actions for "Ward round"', exact: true }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await templateRow("Ward round").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Add sample templates", exact: true }).click();
  await templateRow("Ward round").waitFor();
  await page.getByRole("button", { name: "Add sample templates", exact: true }).click();
  await page.reload();
  for (const name of names) {
    const row = templateRow(name);
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
