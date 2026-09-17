// Run after pnpm build; starts and closes its own temporary production preview.
// Override OPTIO_URL to test another deployment without changing canonical URLs.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite-plus";

const server = process.env.OPTIO_URL
  ? undefined
  : await preview({
      preview: { host: "127.0.0.1", port: 0, open: false },
    });
const base = process.env.OPTIO_URL ?? `http://127.0.0.1:${server.httpServer.address().port}/optio/`;
const canonical = "https://mariusom.github.io/optio/";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
  const page = await context.newPage();
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
  const fallback = page.locator("[data-static-fallback]");
  await assert.doesNotReject(() => fallback.waitFor({ state: "visible" }));
  assert.equal(await fallback.locator("h1").textContent(), "Optio");
  const fallbackText = await fallback.textContent();
  assert.match(fallbackText, /create time studies.*export results as CSV/s);
  assert.match(fallbackText, /no backend or automatic sync/i);
  assert.match(fallbackText, /storage can be cleared or lost/i);
  assert.match(fallbackText, /open-source software/i);
  assert.match(fallbackText, /requires JavaScript and browser storage support/i);
  const meta = (key) => page.locator(`meta[property="${key}"], meta[name="${key}"]`);
  const content = (key) => meta(key).getAttribute("content");
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), canonical);
  assert.equal(await content("og:url"), canonical);
  assert.equal(await content("og:type"), "website");
  assert.equal(await content("twitter:card"), "summary_large_image");
  assert.equal(await content("og:title"), await content("twitter:title"));
  assert.equal(await content("og:description"), await content("twitter:description"));
  for (const key of ["description", "og:description", "twitter:description"]) {
    const value = await content(key);
    assert.ok(value.length > 40 && value.length <= 160, `${key}: concise, meaningful copy`);
    assert.match(value, /CSV/);
  }
  const image = await content("og:image");
  assert.equal(image, `${canonical}social-card.png`);
  assert.equal(await content("twitter:image"), image);
  assert.equal(await content("og:image:type"), "image/png");
  assert.equal(await content("og:image:alt"), await content("twitter:image:alt"));
  assert.match(await content("og:image:alt"), /Offline-ready.*No account.*Open source/);
  const imageResponse = await context.request.get(new URL("social-card.png", base).href);
  assert.equal(imageResponse.status(), 200);
  assert.match(imageResponse.headers()["content-type"], /image\/png/);
  const png = await imageResponse.body();
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(await content("og:image:width"), "1200");
  assert.equal(await content("og:image:height"), "630");
  assert.ok(png.length < 1_000_000, "sharing image stays below 1 MB");

  const structured = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent(),
  );
  assert.equal(structured["@type"], "WebApplication");
  assert.equal(structured.url, canonical);
  assert.equal(structured.image, image);
  const resources = {};
  for (const [rel, file] of [
    ["ai-catalog", "ai-catalog.json"],
    ["alternate", "llms.txt"],
    ["sitemap", "sitemap.xml"],
  ]) {
    const href = await page.locator(`link[rel="${rel}"]`).getAttribute("href");
    assert.equal(href, `/optio/${file}`, "Vite must retain the deployment base path");
    const resource = await context.request.get(new URL(href, base).href);
    assert.equal(resource.status(), 200);
    resources[file] = await resource.text();
    assert.doesNotMatch(resources[file], /<!doctype html>/i, "not an SPA fallback");
  }
  const catalog = JSON.parse(resources["ai-catalog.json"]);
  assert.equal(catalog.specVersion, "1.0");
  assert.equal(catalog.host.displayName, "Optio");
  assert.equal(catalog.entries.length, 1);
  const entry = catalog.entries[0];
  assert.equal(entry.identifier, "urn:air:mariusom.github.io:optio:agent-guide");
  assert.equal(entry.type, "text/markdown");
  assert.equal(entry.url, `${canonical}agent-guide.md`);
  assert.equal(entry.data, undefined);
  const guide = await context.request.get(new URL("agent-guide.md", base).href);
  assert.equal(guide.status(), 200);
  assert.match(await guide.text(), /Never accept consent on the user's behalf/);
  assert.match(resources["llms.txt"], /agent-guide\.md/);
  assert.ok(resources["sitemap.xml"].includes(`<loc>${canonical}</loc>`));
  assert.doesNotMatch(resources["sitemap.xml"], /#|agentTools/);

  await context.close();
  const appBrowser = await chromium.launch();
  const fallbackContext = await appBrowser.newContext();
  try {
    const appPage = await fallbackContext.newPage();
    const appResponse = await appPage.goto(base);
    assert.equal(appResponse.status(), 200);
    await appPage.getByRole("heading").first().waitFor({ state: "visible" });
    assert.equal(
      await appPage.locator("[data-static-fallback]").count(),
      0,
      "the no-JavaScript fallback must not remain in the running app",
    );
    assert.doesNotMatch(await appPage.locator("body").innerText(), /requires JavaScript/i);
  } finally {
    await fallbackContext.close();
    await appBrowser.close();
  }
  console.log(
    "PASS: no-JavaScript fallback and social metadata, running-app replacement, 1200×630 PNG, structured data, and all /optio/ discovery resources",
  );
  const appContext = await browser.newContext();
  const app = await appContext.newPage();
  await app.goto(base);
  await app.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
  // Check precaching before either document has ever been opened.
  for (const offline of [true, false]) {
    await appContext.setOffline(offline);
    for (const [route, label, expected] of [
      ["use-with-ai", "Agent guide", "# Using Optio"],
      ["about", "Third-party notices", "Optio\n=====\n\nMIT License"],
    ]) {
      await app.goto(`${base}#/${route}`);
      if (route === "use-with-ai") await app.locator("summary").click();
      const popupPromise = app.waitForEvent("popup");
      await app.getByRole("link", { name: label }).click();
      const documentPage = await popupPromise;
      await documentPage.waitForLoadState();
      assert.ok(
        (await documentPage.locator("body").innerText()).startsWith(expected),
        `${label} opens the document (offline=${offline}), not the app fallback`,
      );
      await documentPage.close();
    }
  }
  await appContext.close();
  console.log(
    "PASS: help document links open real content with an active service worker, online and offline",
  );

  const navigationContext = await browser.newContext({ viewport: { width: 667, height: 375 } });
  const navigationPage = await navigationContext.newPage();
  for (const [label, introduction] of [
    ["Use with AI", "Create a template with AI"],
    ["About Optio", "Time & motion studies"],
  ]) {
    await navigationPage.goto(`${base}#/settings`);
    await navigationPage.getByText("Help & about", { exact: true }).click();
    await navigationPage.locator("main").evaluate((main) => {
      main.scrollTop = main.scrollHeight;
    });
    assert.ok(await navigationPage.locator("main").evaluate((main) => main.scrollTop > 0));
    await navigationPage.getByRole("link", { name: label, exact: true }).click();
    await navigationPage.getByRole("heading", { name: introduction, exact: true }).waitFor();
    await navigationPage.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    assert.equal(
      await navigationPage.locator("main").evaluate((main) => main.scrollTop),
      0,
      `${label} starts at the top after leaving scrolled Settings`,
    );
    assert.equal(
      await navigationPage
        .locator("main h1")
        .evaluate((heading) => document.activeElement === heading),
      true,
      `${label} heading receives focus`,
    );
  }
  console.log("PASS: help navigation resets the scroll container and focuses the heading");

  await navigationPage.getByRole("link", { name: "Use with AI", exact: true }).click();
  await navigationPage.getByRole("button", { name: "Copy prompt", exact: true }).waitFor();
  await navigationPage.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await navigationPage.clock.install();
  await navigationPage.clock.pauseAt(new Date());
  await navigationPage.evaluate(() => {
    window.copyCalls = 0;
    navigator.clipboard.writeText = () => {
      window.copyCalls++;
      return new Promise((resolve) => {
        window.finishCopy = resolve;
      });
    };
  });
  await navigationPage.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await navigationPage.clock.runFor(32);
  await navigationPage.getByRole("link", { name: "Back to Settings" }).click();
  await navigationPage.clock.runFor(32);
  await navigationPage.getByText("Help & about", { exact: true }).click();
  await navigationPage.getByRole("link", { name: "Use with AI", exact: true }).click();
  await navigationPage.clock.runFor(32);
  assert.equal(
    await navigationPage.getByRole("button", { name: "Copying…", exact: true }).isDisabled(),
    true,
  );
  assert.equal(await navigationPage.evaluate(() => window.copyCalls), 1);

  await navigationPage.evaluate(() => window.finishCopy());
  const completedAt = await navigationPage.evaluate(() => Date.now());
  await navigationPage.clock.runFor(32);
  assert.equal(
    await navigationPage.getByRole("button", { name: "Copied", exact: true }).isDisabled(),
    true,
  );
  // Copy completion must not move focus or reset a reader's scroll position.
  await navigationPage.locator("summary").focus();
  // Stay away from the bottom, where removing feedback naturally clamps scrollTop.
  await navigationPage.locator("main").evaluate((main) => {
    main.scrollTop = 40;
  });
  const elapsed = (await navigationPage.evaluate(() => Date.now())) - completedAt;
  await navigationPage.clock.runFor(2999 - elapsed);
  assert.equal(
    await navigationPage.getByRole("button", { name: "Copied", exact: true }).count(),
    1,
    "feedback remains for the full three seconds",
  );
  await navigationPage.clock.runFor(33);
  assert.equal(
    await navigationPage.getByRole("button", { name: "Copy prompt", exact: true }).isEnabled(),
    true,
  );
  assert.equal(
    await navigationPage
      .locator("summary")
      .evaluate((summary) => document.activeElement === summary),
    true,
  );
  assert.equal(await navigationPage.locator("main").evaluate((main) => main.scrollTop), 40);
  await navigationContext.close();
  console.log(
    "PASS: pending copy survives navigation; feedback lasts three seconds without resetting focus or scroll",
  );
} finally {
  await browser.close();
  await server?.close();
}
