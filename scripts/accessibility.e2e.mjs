// Production accessibility sweep. Run after pnpm build.
// Runs axe-core (WCAG 2.2 A/AA rules) on the main screens of every look in
// light and dark, with the sample templates a fresh install starts with.
// Each look gets a fresh browser context, so storage never leaks between runs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { chromium } from "playwright";
import { preview } from "vite-plus";

const looks = ["classic", "studio", "swiss", "shopfloor", "blueprint"];
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

const audit = async (page, screen) => {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(
    async (runOnly) =>
      (await window.axe.run(document, { runOnly: { type: "tag", values: runOnly } })).violations,
    tags,
  );
  return violations.map(
    (violation) =>
      `${screen}: ${violation.id} (${violation.impact}) ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(" ")}`).join("\n"),
  );
};

void test("every look passes axe on the main screens", { timeout: 300_000 }, async () => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/optio/`;
  const browser = await chromium.launch();
  const failures = [];
  try {
    for (const look of looks) {
      for (const colorScheme of ["light", "dark"]) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme,
          serviceWorkers: "block",
        });
        context.setDefaultTimeout(15_000);
        await context.addInitScript((value) => localStorage.setItem("optio-look", value), look);
        const page = await context.newPage();
        const label = `${look} ${colorScheme}`;
        const visit = async (hash, heading) => {
          await page.goto(`${base}#/${hash}`);
          await page.getByRole("heading", { name: heading, exact: true }).first().waitFor();
          failures.push(...(await audit(page, `${label} ${hash}`)));
        };

        await page.goto(base);
        await page
          .getByRole("option", { name: "Assembly line", exact: true })
          .waitFor({ state: "attached" });
        assert.equal(await page.locator("html").getAttribute("data-look"), look);
        failures.push(...(await audit(page, `${label} start`)));
        await visit("templates", "Templates");
        await visit("history", "History");
        await visit("settings", "Settings");

        await page.goto(base);
        await page.getByRole("button", { name: "Start Session", exact: true }).click();
        await page.getByRole("textbox", { name: "Operation", exact: true }).waitFor();
        failures.push(...(await audit(page, `${label} runner`)));
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
  assert.deepEqual(failures, [], `axe violations:\n${failures.join("\n")}`);
});
