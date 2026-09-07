// Run against a built preview: node scripts/test-session-persistence.mjs <preview URL>
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2];
assert.ok(url, "Pass the app's preview URL (including /optio/)");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${url}#/start`);
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await page.getByRole("textbox", { name: "Activity", exact: true }).fill("Recorded activity");
  await page
    .getByRole("radiogroup", { name: "Category", exact: true })
    .getByText("Communication", { exact: true })
    .click();
  await page.getByRole("radio", { name: "Communication", exact: true, checked: true }).waitFor();
  await page.getByRole("checkbox", { name: "Computer", exact: true }).click();
  await page.getByRole("checkbox", { name: "Computer", exact: true, checked: true }).waitFor();
  await page.getByRole("textbox", { name: "Notes", exact: true }).fill("Recorded notes");
  await page.getByRole("button", { name: "Record Task and Next", exact: true }).click();
  await page.getByRole("button", { name: "Task 1 completed", exact: true }).waitFor();

  // Hash navigation and a full reload must both preserve the recorded answers.
  for (const reload of [false, true]) {
    await page.evaluate(() => {
      location.hash = "#/start";
    });
    if (reload) await page.reload();
    await page.getByRole("button", { name: "Resume Session", exact: true }).click();
    await page.getByRole("button", { name: "Task 1 completed", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('input[aria-label="Activity"]')?.value === "Recorded activity",
    );
    assert.equal(
      await page.getByRole("textbox", { name: "Notes", exact: true }).inputValue(),
      "Recorded notes",
    );
    assert.ok(await page.getByRole("radio", { name: "Communication", exact: true }).isChecked());
    assert.ok(await page.getByRole("checkbox", { name: "Computer", exact: true }).isChecked());
    await page.getByRole("button", { name: "Cancel Editing", exact: true }).click();
    await page.getByRole("button", { name: "Task 1 completed", exact: true }).waitFor();
    console.log(
      `${reload ? "Reload" : "Homepage navigation"}: recorded task and all answers persisted`,
    );
  }
} finally {
  await browser.close();
}
