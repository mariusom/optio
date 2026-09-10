// Production browser journey. Uses real workers, SQLite/OPFS and the service worker.
// Run after pnpm build. Each run owns and removes a disposable browser profile.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { preview } from "vite-plus";

test(
  "real storage survives restart, edit cancellation and offline export",
  { timeout: 120_000 },
  async () => {
    const profile = await mkdtemp(join(tmpdir(), "optio-e2e-"));
    const server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}/optio/`;
    const errors = [];
    let context;
    let page;
    const launch = async () => {
      context = await chromium.launchPersistentContext(profile, {
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: "light",
      });
      context.setDefaultTimeout(15_000);
      page = context.pages()[0];
      page.on("pageerror", (error) => errors.push(error.message));
    };
    const screenshot = async (name) => {
      if (!process.env.OPTIO_SCREENSHOTS) return;
      await mkdir(process.env.OPTIO_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: join(process.env.OPTIO_SCREENSHOTS, `${name}.png`),
        animations: "disabled",
      });
    };
    const operation = () => page.getByRole("textbox", { name: "Operation", exact: true });
    const waitValue = async (value) => {
      await operation().waitFor();
      await page.waitForFunction((expected) => {
        const input = document.querySelector('input[aria-label="Operation"]');
        return input?.value === expected;
      }, value);
    };
    const download = async (button) => {
      const ready = page.waitForEvent("download");
      await page.getByRole("button", { name: button, exact: true }).click();
      const file = await ready;
      return { name: file.suggestedFilename(), csv: await readFile(await file.path(), "utf8") };
    };

    try {
      await launch();
      await page.goto(base);
      await page
        .getByRole("option", { name: "Assembly line (default)", exact: true })
        .waitFor({ state: "attached" });
      await page
        .getByRole("textbox", { name: "Session name", exact: true })
        .fill("Assembly observation");
      await page.getByRole("button", { name: "Start Session", exact: true }).click();
      await operation().waitFor();
      const runnerUrl = page.url();
      await page.getByRole("radio", { name: "Station 2", exact: true }).press("Space");
      await operation().fill("Torque bolts");
      await page.getByRole("radio", { name: "Value-added", exact: true }).press("Space");
      await page.getByRole("checkbox", { name: "Torque driver", exact: true }).press("Space");
      await page.getByRole("button", { name: "Record task", exact: true }).click();
      await page.getByRole("button", { name: "Task 2 in progress", exact: true }).waitFor();

      // Begin a completed-task edit, confirm it reached persistent state, then
      // restart the entire browser, not just the view/model test harness.
      await page.getByRole("button", { name: "Task 1 completed", exact: true }).click();
      await waitValue("Torque bolts");
      await operation().fill("Unsaved correction");
      await page.reload();
      await waitValue("Unsaved correction");
      await context.close();
      await launch();
      await page.goto(runnerUrl);
      await waitValue("Unsaved correction");
      await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
      await page.getByRole("button", { name: "Task 1 completed", exact: true }).click();
      await waitValue("Torque bolts");
      assert.equal(
        await page.getByRole("radio", { name: "Station 2", exact: true }).isChecked(),
        true,
      );
      assert.equal(
        await page.getByRole("checkbox", { name: "Torque driver", exact: true }).isChecked(),
        true,
      );
      await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
      await page.getByRole("button", { name: "Task 2 in progress", exact: true }).click();

      await page.getByRole("radio", { name: "Station 3", exact: true }).press("Space");
      await operation().fill("Inspect alignment");
      await page.getByRole("radio", { name: "Inspection", exact: true }).press("Space");
      await page.getByRole("textbox", { name: "Notes", exact: true }).fill("=1+2");
      if (process.env.OPTIO_SCREENSHOTS)
        await page.locator("#tablet-formTop").scrollIntoViewIfNeeded();
      await screenshot("recording");
      await page.getByRole("button", { name: "Record task", exact: true }).click();
      await page.getByRole("button", { name: "Task 3 in progress", exact: true }).waitFor();

      // Wait for installed precache before simulating network loss. Actual
      // offline reload must reopen the real local database and its workers.
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      await context.setOffline(true);
      await page.reload();
      await page.getByRole("button", { name: "Task 3 in progress", exact: true }).waitFor();
      await page.getByRole("button", { name: "End session", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "End session", exact: true })
        .click();
      await page.goto(`${base}#/history`);
      await page
        .getByRole("button", { name: "Open session Assembly observation", exact: true })
        .click();
      await page.getByRole("button", { name: "View details for Task 2", exact: true }).waitFor();
      await screenshot("results");

      const exported = await download("Export Assembly observation");
      assert.ok(!exported.name.endsWith("_spreadsheet.csv"));
      assert.ok(exported.csv.includes('"\'=1+2"'));
      assert.ok(exported.csv.includes('"Torque bolts"'));
      assert.ok(exported.csv.includes('"Inspect alignment"'));
      assert.ok(!exported.csv.includes("Unsaved correction"));
      assert.equal(exported.csv.split("\n").length, 3);
      assert.equal(await page.getByRole("dialog").count(), 0);

      await page.reload();
      const reloaded = await download("Export Assembly observation");
      assert.equal(
        reloaded.csv,
        exported.csv,
        "reload must preserve values and timestamps exactly",
      );
      await context.setOffline(false);
      const notices = await context.request.get(`${base}THIRD_PARTY_NOTICES.txt`);
      assert.equal(notices.status(), 200);
      assert.match(await notices.text(), /Copyright \(c\) 2026 elianiva/);

      const archiveUrl = page.url();
      for (const [width, height, colorScheme] of [
        [390, 844, "light"],
        [820, 1180, "dark"],
        [1280, 900, "light"],
      ]) {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme });
        await page.goto(archiveUrl);
        await page
          .getByRole("button", { name: "Delete Assembly observation", exact: true })
          .waitFor();
        const downloaded = await download("Export Assembly observation");
        assert.equal(downloaded.csv, exported.csv);
        assert.equal(await page.getByRole("dialog").count(), 0);
        await screenshot(`export-${width}-${colorScheme}`);

        await page.goto(`${base}#/settings`);
        const privacy = page.getByText(
          "Optional assistant access can share study data with your assistant provider.",
          { exact: true },
        );
        await privacy.scrollIntoViewIfNeeded();
        assert.equal(
          await privacy.evaluate((node) => node.scrollWidth <= node.clientWidth),
          true,
          "privacy text must wrap, not clip",
        );
        await screenshot(`privacy-${width}-${colorScheme}`);
      }
      assert.deepEqual(errors, []);
    } finally {
      await context?.close();
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(profile, { recursive: true, force: true });
    }
  },
);
