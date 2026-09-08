// Screenshot tour: every screen at phone/tablet/desktop, light and dark.
// Usage: pnpm build && pnpm preview --port 60002 & node scripts/screenshots/tour.mjs /tmp/tour
import { chromium } from "playwright";

const out = process.argv[2] ?? "/tmp/tour";
const base = process.env.OPTIO_URL ?? "http://localhost:60002/optio/";
const sizes = { phone: [390, 844], tablet: [820, 1180], desktop: [1440, 900] };
const browser = await chromium.launch({ channel: "chromium" });

for (const scheme of ["light", "dark"]) {
  for (const [size, [width, height]] of Object.entries(sizes)) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await context.newPage();
    const shot = (name) => page.screenshot({ path: `${out}/${size}-${scheme}-${name}.png` });
    const step = async (name, run) => {
      try {
        await run();
      } catch (error) {
        console.log("FAIL", size, scheme, name, String(error.message).split("\n")[0]);
      }
    };
    const open = async (hash) => {
      await page.goto(base + hash, { waitUntil: "load" });
      await page.waitForSelector("main");
      await page.waitForTimeout(800);
    };

    await open("#templates");
    await page.waitForTimeout(5000); // local database boot
    await shot("templates");
    await step("template-actions", async () => {
      await page
        .getByRole("button", { name: /Actions for/ })
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(400);
      await shot("template-actions");
      await page.keyboard.press("Escape");
    });
    await step("editor", async () => {
      await page
        .getByRole("button", { name: /Assembly line/ })
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(800);
      await shot("editor");
      await page.getByRole("button", { name: /Edit question Tools used/ }).click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot("question-sheet");
      await page.keyboard.press("Escape");
    });
    await open("#start");
    await shot("start");
    await step("session", async () => {
      await page.getByRole("button", { name: "Start Session" }).click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await shot("runner-empty");
      await page.getByRole("radio", { name: "Station 2" }).first().check({ timeout: 5000 });
      await page.getByPlaceholder(/./).first().fill("Torque bolts");
      await page.getByRole("radio", { name: "Walking" }).first().check({ timeout: 5000 });
      await shot("runner-filled");
      await page.getByRole("button", { name: "Record task" }).first().click({ timeout: 5000 });
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Show task list" }).first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot("runner-tasks");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "End" }).first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot("runner-end");
      await page.getByRole("button", { name: "End session" }).last().click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    });
    await step("history", async () => {
      await open("#history");
      await shot("history");
      await page
        .getByRole("button", { name: /Actions for/ })
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(400);
      await shot("history-actions");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: /Open session/ })
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(800);
      await shot("session-detail");
      await page
        .getByRole("button", { name: /^Task 1/ })
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot("task-detail");
    });
    await open("#settings");
    await shot("settings");
    await context.close();
  }
}
await browser.close();
