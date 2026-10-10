// Screenshot tour: every screen at phone/tablet/desktop, light and dark.
// Usage: pnpm build && pnpm preview --port 60002 & node scripts/screenshots/tour.mjs /tmp/tour
import { chromium } from "playwright";

const out = process.argv[2] ?? "/tmp/tour";
const base = process.env.OPTIO_URL ?? "http://localhost:60002/optio/";
const allSizes = { phone: [390, 844], tablet: [820, 1180], desktop: [1440, 900] };
// Optional comma-separated filters, e.g. OPTIO_SIZES=phone OPTIO_SCHEMES=dark.
const pick = (value, all) => (value ? value.split(",") : all);
const sizes = pick(process.env.OPTIO_SIZES, Object.keys(allSizes));
const schemes = pick(process.env.OPTIO_SCHEMES, ["light", "dark"]);
const browser = await chromium.launch();
let failures = 0;

for (const scheme of schemes) {
  for (const size of sizes) {
    const [width, height] = allSizes[size];
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await context.newPage();
    const shot = (name) => page.screenshot({ path: `${out}/${size}-${scheme}-${name}.png` });
    const step = async (name, run) => {
      try {
        await run();
      } catch (error) {
        failures += 1;
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
        .getByRole("button", { name: /^Assembly line / })
        .first()
        .click({ timeout: 5000 });
      await page.waitForTimeout(800);
      await shot("editor");
      await page.getByRole("button", { name: /^Tools used / }).click({ timeout: 5000 });
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
      // Choice inputs are visually hidden; select them from the keyboard.
      const choose = (role, name) =>
        page.getByRole(role, { name, exact: true }).first().press("Space", { timeout: 5000 });
      await choose("radio", "Station 2");
      await page.getByRole("textbox", { name: "Operation" }).first().fill("Torque bolts");
      await choose("radio", "Walking");
      await choose("checkbox", "Hoist");
      // Wait for the saved state and the tile's colour transition before the shot.
      await page
        .getByRole("checkbox", { name: "Hoist", exact: true, checked: true })
        .first()
        .waitFor({ timeout: 5000 });
      await page.waitForTimeout(300);
      await shot("runner-filled");
      await page.getByRole("button", { name: "Record task" }).first().click({ timeout: 5000 });
      await page.waitForTimeout(800);
      // Phones open the task list in a sheet; wider layouts show it in a column.
      const showTasks = page.getByRole("button", { name: "Show task list" }).first();
      const tasksInSheet = await showTasks.isVisible();
      if (tasksInSheet) {
        await showTasks.click({ timeout: 5000 });
        await page.waitForTimeout(500);
      }
      await shot("runner-tasks");
      if (tasksInSheet) await page.keyboard.press("Escape");
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
      await page.getByText("Task 1", { exact: true }).first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await shot("task-detail");
    });
    await open("#settings");
    await shot("settings");
    await context.close();
  }
}
await browser.close();
if (failures > 0) {
  console.log(`${failures} tour step(s) failed`);
  process.exitCode = 1;
}
