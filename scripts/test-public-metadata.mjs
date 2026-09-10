// Run against a production preview: node scripts/test-public-metadata.mjs
// Override OPTIO_URL to test another deployment without changing canonical URLs.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.OPTIO_URL ?? "http://localhost:60002/optio/";
const canonical = "https://mariusom.github.io/optio/";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
  const page = await context.newPage();
  const response = await page.goto(base);
  assert.equal(response.status(), 200);
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
  console.log(
    "PASS: no-JavaScript social metadata, 1200×630 PNG, structured data, and all /optio/ discovery resources",
  );
} finally {
  await browser.close();
}
