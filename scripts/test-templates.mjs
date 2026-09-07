// Run against a built preview: node scripts/test-templates.mjs <preview URL>
// Requires: pnpm exec playwright install --with-deps chromium webkit
import assert from "node:assert/strict";
import { chromium, webkit, devices } from "playwright";

const url = process.argv[2];
assert.ok(url, "Pass the app's preview URL (including /optio/)");

for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await context.newPage();
    // Exercise real workers and SQLite: component mocks cannot catch RPC incompatibility.
    await page.goto(`${url}#/templates`);
    await page
      .getByRole("button", { name: "Edit template Sample Study", exact: true })
      .last()
      .waitFor();
    assert.ok(await page.getByText("Default", { exact: true }).last().isVisible());
    await page.getByRole("button", { name: "Create new template", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New Template Dialog" });
    const create = dialog.getByRole("button", { name: "Create Template", exact: true });
    assert.ok(await create.isDisabled());
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 375, height: 400 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await dialog.getByRole("textbox", { name: "Template Name" }).fill("Mobile Study");
      const box = await dialog.locator(".modal-box").boundingBox();
      assert.ok(box);
      assert.ok(
        Math.abs(box.x + box.width / 2 - viewport.width / 2) < 1,
        `Drawer must be horizontally centred at ${viewport.width}px`,
      );
      assert.ok(box.y >= 0 && box.y + box.height <= viewport.height + 1);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await create.click();
    await dialog.waitFor({ state: "detached" });
    await page
      .getByRole("button", { name: "Edit template Mobile Study", exact: true })
      .last()
      .waitFor();
    // Chromium provides persistent OPFS here; headless WebKit denies storage access.
    if (browserType === chromium) {
      await page.reload();
      await page
        .getByRole("button", { name: "Edit template Mobile Study", exact: true })
        .last()
        .waitFor();
    }
    console.log(
      `${browserType.name()}: default seeded, template created, drawer centred at 4 sizes${browserType === chromium ? ", reload persisted" : " (storage-denied fallback)"}`,
    );
    await context.close();
  } finally {
    await browser.close();
  }
}
