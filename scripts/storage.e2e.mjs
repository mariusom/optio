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
      const offlineNotices = await page.evaluate(async () => {
        const response = await fetch("THIRD_PARTY_NOTICES.txt");
        return { status: response.status, text: await response.text() };
      });
      assert.equal(offlineNotices.status, 200);
      assert.match(offlineNotices.text, /Copyright \(c\) 2026 Marius Matei/);
      assert.match(offlineNotices.text, /Copyright \(c\) 2015 Simon Friis Vindum/);
      const offlineInventory = await page.evaluate(async () => {
        const response = await fetch("dependency-inventory.json");
        return response.json();
      });
      assert.ok(offlineInventory.packages.some(({ name }) => name === "cn"));
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

test(
  "quantitative sample records, reloads and exports distinct answers",
  { timeout: 120_000 },
  async () => {
    const server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}/optio/`;
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    page.setDefaultTimeout(15_000);
    const input = (name) => page.getByRole("textbox", { name, exact: true });
    const waitValue = async (name, value) => {
      await page.waitForFunction(
        ({ name: label, value: expected }) =>
          [...document.querySelectorAll("input")].some(
            (el) => el.getAttribute("aria-label") === label && el.value === expected,
          ),
        { name, value },
      );
    };
    try {
      await page.goto(base);
      await page
        .getByRole("option", { name: "Packing measurements", exact: true })
        .waitFor({ state: "attached" });
      await page.getByRole("combobox").selectOption({ label: "Packing measurements" });
      await input("Session name").fill("Quantitative check");
      await page.getByRole("button", { name: "Start Session", exact: true }).click();
      const record = page.getByRole("button", { name: "Record task", exact: true });
      await input("Parcel weight (kg)").waitFor();
      assert.equal(await record.isDisabled(), true);
      assert.equal(
        await page.getByRole("radio", { name: "Unanswered", exact: true }).isChecked(),
        true,
      );
      await input("Parcel weight (kg)").fill("2.75");
      await page.getByRole("button", { name: "Increase Items packed" }).click();
      await waitValue("Items packed", "1");
      // Deliberately burst clicks before a fresh rendered store snapshot arrives.
      await page.getByRole("button", { name: "Increase Items packed" }).evaluate((button) => {
        for (let i = 0; i < 12; i++) button.click();
      });
      await waitValue("Items packed", "13");
      await page.getByRole("button", { name: "Decrease Items packed" }).click();
      await waitValue("Items packed", "12");
      await page.getByRole("radio", { name: "4", exact: true }).press("Space");
      assert.equal(await record.isDisabled(), true, "unanswered required Yes/No blocks recording");
      await page.getByRole("radio", { name: "No", exact: true }).press("Space");
      await input("Parcel weight (kg)").fill("not a number");
      await page
        .getByText("Correct invalid answers before continuing.")
        .filter({ visible: true })
        .waitFor();
      assert.equal(await record.isDisabled(), true);
      await input("Parcel weight (kg)").fill("2.75");
      // Wait for the store notification, not just the input's local DOM value.
      await page.waitForFunction(() =>
        [...document.querySelectorAll('button[aria-label="Record task"]')].some(
          (button) =>
            button.getClientRects().length > 0 &&
            !button.matches(':disabled, [aria-disabled="true"]'),
        ),
      );
      // LiveStore exposes its existing store for debugging; no extra app/test API.
      // A query notification precedes the leader's OPFS commit acknowledgement.
      await page.waitForFunction(
        () => globalThis["__debugLiveStore"]?.["optio-v3"]?.syncStatus().pendingCount === 0,
      );
      assert.equal(
        await page.evaluate(() => globalThis["__debugLiveStore"]["optio-v3"].storageMode),
        "persisted",
      );
      await page.reload();
      await input("Parcel weight (kg)").waitFor();
      assert.equal(await input("Parcel weight (kg)").inputValue(), "2.75", "reloaded weight");
      await waitValue("Parcel weight (kg)", "2.75");
      await waitValue("Items packed", "12");
      assert.equal(await page.getByRole("radio", { name: "4", exact: true }).isChecked(), true);
      assert.equal(await page.getByRole("radio", { name: "No", exact: true }).isChecked(), true);
      if (process.env.OPTIO_SCREENSHOTS) {
        await mkdir(process.env.OPTIO_SCREENSHOTS, { recursive: true });
        for (const [width, height, colorScheme] of [
          [1280, 850, "light"],
          [390, 844, "light"],
          [820, 1000, "dark"],
        ]) {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ colorScheme });
          await page.waitForFunction(
            (dark) => document.documentElement.classList.contains("dark") === dark,
            colorScheme === "dark",
          );
          await page.screenshot({
            path: join(process.env.OPTIO_SCREENSHOTS, `measurements-${width}.png`),
            animations: "disabled",
          });
        }
        await page.setViewportSize({ width: 1280, height: 900 });
      }
      await page.getByRole("button", { name: "Clear Effort (1 = easy, 5 = very hard)" }).click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('button[aria-label="Record task"]')].some(
          (button) =>
            button.getClientRects().length > 0 &&
            button.matches(':disabled, [aria-disabled="true"]'),
        ),
      );
      assert.equal(await record.isDisabled(), true);
      await page.getByRole("radio", { name: "4", exact: true }).press("Space");
      await record.click();
      await page.getByRole("button", { name: "Task 2 in progress", exact: true }).waitFor();
      await waitValue("Items packed", "");
      assert.equal(
        await page.getByRole("radio", { name: "Unanswered", exact: true }).isChecked(),
        true,
      );
      await page.getByRole("button", { name: "Task 1 completed", exact: true }).click();
      await waitValue("Items packed", "12");
      await input("Items packed").fill("-1");
      await page
        .getByText("Correct invalid answers before continuing.")
        .filter({ visible: true })
        .waitFor();
      await page.getByRole("button", { name: "Task 2 in progress", exact: true }).click();
      await page
        .getByText(
          "Complete required questions and correct invalid answers, or cancel the edit first.",
        )
        .filter({ visible: true })
        .waitFor();
      assert.equal(await input("Items packed").inputValue(), "-1", "invalid edit stays selected");
      await page.getByRole("button", { name: "End session", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "End session", exact: true })
        .click();
      await page
        .getByText(
          "Open task 1 and complete required questions and correct invalid answers, or cancel the edit first.",
        )
        .filter({ visible: true })
        .waitFor();
      assert.equal(
        await input("Items packed").inputValue(),
        "-1",
        "failed end retains live values",
      );
      await page.waitForFunction(
        () => globalThis["__debugLiveStore"]?.["optio-v3"]?.syncStatus().pendingCount === 0,
      );
      await page.reload();
      await input("Items packed").waitFor();
      await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
      await page.getByRole("button", { name: "Task 1 completed", exact: true }).click();
      await waitValue("Items packed", "12");
      await input("Items packed").fill("0");
      await waitValue("Items packed", "0");
      // fill() changes the input before the store notification updates sibling controls.
      await page.getByRole("button", { name: "Decrease Items packed", disabled: true }).waitFor();
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.getByRole("button", { name: "End session", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "End session", exact: true })
        .click();
      await page.goto(`${base}#/history`);
      await page
        .getByRole("button", { name: "Open session Quantitative check", exact: true })
        .click();
      await page.getByRole("button", { name: "Export Quantitative check", exact: true }).waitFor();
      const ready = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export Quantitative check", exact: true }).click();
      const file = await ready;
      const csv = await readFile(await file.path(), "utf8");
      assert.equal(
        csv.split("\n")[0],
        'id,"Effort (1 = easy, 5 = very hard)","Items packed","Parcel weight (kg)","Quality check passed",startTime,endTime',
      );
      assert.ok(csv.split("\n")[1].startsWith("1,4,0,2.75,false,"), csv);
      assert.equal(csv.split("\n").length, 2);
    } finally {
      await browser.close();
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);
