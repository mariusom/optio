// Production-build checks: pnpm build, supervised preview on 60002, then run this script.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.OPTIO_URL ?? "http://localhost:60002/optio/";
const preset = "**/componentStyles.generated-*.js";
const browser = await chromium.launch();
try {
  // Disable the service worker here to distinguish UI demand from offline precaching.
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("componentStyles.generated-")) requests++;
  });
  await page.route(preset, (route) => route.abort());
  await page.goto(base);
  await page.getByRole("button", { name: "Start Session", exact: true }).waitFor();
  assert.equal(requests, 0, "Default startup must not request optional presets");
  await page.goto(`${base}#/settings`);
  const styles = page.getByRole("radiogroup", { name: "Component style" });
  await styles.getByRole("radio", { name: "Vega", exact: true }).click();
  await page.getByText("Couldn't load that style.", { exact: false }).waitFor();
  assert.equal(
    await styles.getByRole("radio", { name: "Nova", exact: true }).getAttribute("aria-checked"),
    "true",
  );
  assert.equal(await page.evaluate(() => document.documentElement.dataset.foldcnStyle), "nova");
  console.log("PASS: default startup skips presets; failed selection retains the applied style");
  await page.unroute(preset);
  // Browsers cache failed module imports for the document's lifetime.
  await page.reload();
  await styles.getByRole("radio", { name: "Vega", exact: true }).click();
  await page.waitForFunction(() => localStorage.getItem("optio-foldcn-style") === "vega");
  await page.reload();
  await styles.getByRole("radio", { name: "Vega", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.foldcnStyle), "vega");
  console.log("PASS: retry applies the preset and a reload restores it");
  await page.route(preset, (route) => route.abort());
  await page.reload();
  await styles.getByRole("radio", { name: "Nova", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.foldcnStyle), "nova");
  assert.equal(await page.evaluate(() => localStorage.getItem("optio-foldcn-style")), "vega");
  console.log("PASS: unavailable saved preset falls back without deleting the preference");
  await context.close();

  const storageFailure = await browser.newContext({ serviceWorkers: "block" });
  await storageFailure.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "optio-foldcn-style")
        throw new DOMException("Storage full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  const storagePage = await storageFailure.newPage();
  await storagePage.goto(`${base}#/settings`);
  await storagePage.getByRole("radio", { name: "Vega", exact: true }).click();
  await storagePage.getByText("The component style was applied but couldn’t be saved.").waitFor();
  assert.equal(
    await storagePage.evaluate(() => document.documentElement.dataset.foldcnStyle),
    "vega",
  );
  assert.equal(await storagePage.getByText("Reload the app", { exact: false }).count(), 0);
  console.log("PASS: storage failure keeps the applied style and does not advise reloading");
  await storageFailure.close();

  const offline = await browser.newContext();
  const offlinePage = await offline.newPage();
  await offlinePage.goto(`${base}#/settings`);
  await offlinePage.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await offline.setOffline(true);
  await offlinePage.reload();
  await offlinePage
    .getByRole("radiogroup", { name: "Component style" })
    .getByRole("radio", { name: "Lyra", exact: true })
    .click();
  await offlinePage.waitForFunction(() => localStorage.getItem("optio-foldcn-style") === "lyra");
  await offlinePage.reload();
  await offlinePage.getByRole("radio", { name: "Lyra", exact: true }).waitFor();
  assert.equal(
    await offlinePage.evaluate(() => document.documentElement.dataset.foldcnStyle),
    "lyra",
  );
  console.log("PASS: a previously unselected preset is available offline and survives reload");
  await offline.close();
} finally {
  await browser.close();
}
