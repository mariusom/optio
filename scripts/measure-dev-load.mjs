// Usage: node scripts/measure-dev-load.mjs http://localhost:<port>/optio/
// Measures first usable session setup with disposable storage and 250 ms latency.
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 250,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  const requests = new Map();
  cdp.on("Network.requestWillBeSent", (event) =>
    requests.set(event.requestId, {
      url: event.request.url,
      type: event.type,
      start: event.timestamp,
      initiator: event.initiator.stack?.callFrames[0]?.url,
    }),
  );
  cdp.on("Network.responseReceived", (event) => {
    const request = requests.get(event.requestId);
    if (request)
      Object.assign(request, { response: event.timestamp, timing: event.response.timing });
  });
  const start = performance.now();
  await page.goto(process.argv[2]);
  await page.getByRole("button", { name: "Start Session", exact: true }).waitFor();
  const readyMs = performance.now() - start;
  await page.waitForTimeout(500);
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => ({
      url: r.name,
      startMs: Math.round(r.startTime),
      ttfbMs: Math.round(r.responseStart - r.requestStart),
      durationMs: Math.round(r.duration),
    })),
  );
  console.log(
    JSON.stringify(
      {
        readyMs: Math.round(readyMs),
        requests: requests.size,
        scripts: [...requests.values()].filter((r) => r.type === "Script").length,
        resources,
        network: [...requests.values()],
      },
      null,
      2,
    ),
  );
  if (requests.size > 50) throw new Error(`Excessive dev waterfall: ${requests.size} requests`);
} finally {
  await browser.close();
}
