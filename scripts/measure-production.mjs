// Measures the real production build with disposable Chromium storage.
// Usage: pnpm build && node scripts/measure-production.mjs <preview URL> [output.json]
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:60002/optio/";
const output = process.argv[3];
const runs = Number(process.env.OPTIO_PERF_RUNS ?? 3);
const taskCount = Number(process.env.OPTIO_PERF_TASKS ?? 30);
assert.ok(Number.isInteger(runs) && runs > 0, "OPTIO_PERF_RUNS must be a positive integer");
assert.ok(
  Number.isInteger(taskCount) && taskCount > 1,
  "OPTIO_PERF_TASKS must be an integer greater than one",
);

const initPerformanceObserver = () => {
  const state = {
    appRenderedMs: null,
    shellReadyMs: null,
    storeReadyMs: null,
    uiReadyMs: null,
    longTasks: [],
    paints: [],
  };
  window.__optioPerformance = state;
  if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
      }
    }).observe({ type: "longtask", buffered: true });
  }
  if (PerformanceObserver.supportedEntryTypes.includes("paint")) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.paints.push({ name: entry.name, startMs: entry.startTime });
      }
    }).observe({ type: "paint", buffered: true });
  }

  const sample = () => {
    const now = performance.now();
    if (state.appRenderedMs === null && document.querySelector(".app-shell")) {
      state.appRenderedMs = now;
    }
    const start = document.querySelector('button[aria-label="Start Session"]');
    if (state.shellReadyMs === null && start) state.shellReadyMs = now;
    const options = [...document.querySelectorAll("option")];
    if (
      state.storeReadyMs === null &&
      options.some((option) => option.textContent?.includes("Assembly line"))
    ) {
      state.storeReadyMs = now;
    }
    if (state.uiReadyMs === null && start && !start.disabled && state.storeReadyMs !== null) {
      state.uiReadyMs = now;
    }
    if (state.uiReadyMs === null) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
};

const round = (value) => Math.round(value * 10) / 10;
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};
const summarize = (values) => ({
  minMs: Math.min(...values),
  medianMs: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  maxMs: Math.max(...values),
});

const setNetworkLatency = async (cdp, latencyMs) => {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: latencyMs,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: latencyMs === 0 ? "none" : "other",
  });
};

const measureNavigation = async ({ context, page, cdp, latencyMs, navigate }) => {
  await setNetworkLatency(cdp, latencyMs);
  const requests = new Map();
  let documentStart;
  const contextRequests = new Map();
  const requestListener = (request) =>
    contextRequests.set(request.url(), {
      path: new URL(request.url()).pathname,
      type: request.resourceType(),
    });
  const requestWillBeSent = (event) => {
    if (documentStart === undefined && event.type === "Document") documentStart = event.timestamp;
    requests.set(event.requestId, {
      url: event.request.url,
      type: event.type,
      start: event.timestamp,
      initiatorType: event.initiator.type,
      initiatorUrl: event.initiator.stack?.callFrames[0]?.url,
    });
  };
  const responseReceived = (event) => {
    const request = requests.get(event.requestId);
    if (!request) return;
    Object.assign(request, {
      status: event.response.status,
      response: event.timestamp,
      fromDiskCache: event.response.fromDiskCache,
      fromServiceWorker: event.response.fromServiceWorker,
      protocol: event.response.protocol,
    });
  };
  const loadingFinished = (event) => {
    const request = requests.get(event.requestId);
    if (!request) return;
    request.finished = event.timestamp;
    request.encodedBytes = event.encodedDataLength;
  };
  context.on("request", requestListener);
  cdp.on("Network.requestWillBeSent", requestWillBeSent);
  cdp.on("Network.responseReceived", responseReceived);
  cdp.on("Network.loadingFinished", loadingFinished);
  await cdp.send("Performance.enable");

  await navigate();
  await page.getByRole("button", { name: "Start Session", exact: true }).waitFor();
  await page
    .getByRole("option", { name: "Assembly line (default)", exact: true })
    .waitFor({ state: "attached" });
  await page.waitForFunction(() => typeof window.__optioPerformance?.uiReadyMs === "number");
  const readySnapshot = await page.evaluate(() => ({ ...window.__optioPerformance }));
  for (const key of ["appRenderedMs", "shellReadyMs", "storeReadyMs", "uiReadyMs"]) {
    assert.equal(typeof readySnapshot[key], "number", `Missing readiness signal: ${key}`);
  }
  const afterMetrics = await cdp.send("Performance.getMetrics");
  const afterTaskDuration =
    afterMetrics.metrics.find((metric) => metric.name === "TaskDuration")?.value ?? 0;
  // Let resource completions settle without counting that extra window as startup CPU.
  await page.waitForTimeout(750);
  const browserTimings = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    return {
      navigation: {
        responseStartMs: navigation.responseStart,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadEventMs: navigation.loadEventEnd,
        transferBytes: navigation.transferSize,
      },
      resourceTransferBytes: resources.reduce((sum, resource) => sum + resource.transferSize, 0),
    };
  });
  const network = [...requests.values()].map((request) => ({
    ...request,
    startMs: documentStart === undefined ? null : round((request.start - documentStart) * 1000),
    responseMs:
      documentStart === undefined || request.response === undefined
        ? null
        : round((request.response - documentStart) * 1000),
    finishMs:
      documentStart === undefined || request.finished === undefined
        ? null
        : round((request.finished - documentStart) * 1000),
    start: undefined,
    response: undefined,
    finished: undefined,
  }));
  const readyNetwork = network.filter(
    (request) => request.startMs !== null && request.startMs <= readySnapshot.uiReadyMs,
  );
  const documentRequest = network.find((request) => request.type === "Document");

  context.off("request", requestListener);
  cdp.off("Network.requestWillBeSent", requestWillBeSent);
  cdp.off("Network.responseReceived", responseReceived);
  cdp.off("Network.loadingFinished", loadingFinished);
  return {
    latencyMs,
    readiness: {
      appRenderedMs: round(readySnapshot.appRenderedMs),
      shellReadyMs: round(readySnapshot.shellReadyMs),
      storeReadyMs: round(readySnapshot.storeReadyMs),
      uiReadyMs: round(readySnapshot.uiReadyMs),
    },
    navigation: Object.fromEntries(
      Object.entries(browserTimings.navigation).map(([key, value]) => [key, round(value)]),
    ),
    mainThread: {
      // CDP resets TaskDuration when a navigation replaces the document.
      taskDurationMs: round(afterTaskDuration * 1000),
      longTaskCount: readySnapshot.longTasks.length,
      longTaskTotalMs: round(
        readySnapshot.longTasks.reduce((sum, task) => sum + task.durationMs, 0),
      ),
      longestTaskMs: round(Math.max(0, ...readySnapshot.longTasks.map((task) => task.durationMs))),
      paints: readySnapshot.paints.map(({ name, startMs }) => ({ name, startMs: round(startMs) })),
    },
    network: {
      targetRequestCount: network.length,
      contextUniqueRequestCount: contextRequests.size,
      scriptRequestCount: network.filter((request) => request.type === "Script").length,
      documentTtfbMs:
        documentRequest?.responseMs === null || documentRequest?.responseMs === undefined
          ? null
          : round(documentRequest.responseMs - documentRequest.startMs),
      pageTargetEncodedBytes: network.reduce(
        (sum, request) => sum + (request.encodedBytes ?? 0),
        0,
      ),
      pageTargetBytesStartedByUiReady: readyNetwork.reduce(
        (sum, request) => sum + (request.encodedBytes ?? 0),
        0,
      ),
      pageResourceTransferBytes: browserTimings.resourceTransferBytes,
      contextRequests: [...contextRequests.values()],
      requests: network,
    },
  };
};

const runStartup = async (browser, latencyMs) => {
  const context = await browser.newContext();
  await context.addInitScript(initPerformanceObserver);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const cold = await measureNavigation({
    context,
    page,
    cdp,
    latencyMs,
    navigate: () => page.goto(base),
  });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const controlledReload = await measureNavigation({
    context,
    page,
    cdp,
    latencyMs,
    navigate: () => page.reload(),
  });
  controlledReload.serviceWorkerControlled = await page.evaluate(
    () => navigator.serviceWorker.controller !== null,
  );
  assert.equal(
    controlledReload.serviceWorkerControlled,
    true,
    "Reload must use the service worker",
  );
  await context.close();
  return { cold, controlledReload };
};

const runInteraction = async (browser) => {
  const context = await browser.newContext();
  await context.addInitScript(initPerformanceObserver);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto(base);
  await page
    .getByRole("option", { name: "Assembly line (default)", exact: true })
    .waitFor({ state: "attached" });
  await page.getByRole("textbox", { name: "Session name", exact: true }).fill("Performance run");
  let started = performance.now();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await page.getByRole("textbox", { name: "Operation", exact: true }).waitFor();
  const startSessionMs = round(performance.now() - started);
  const runnerUrl = page.url();
  const stations = ["Station 1", "Station 2", "Station 3", "Station 4", "Station 5"];
  const types = ["Value-added", "Walking", "Waiting", "Setup", "Inspection"];
  const tools = ["Torque driver", "Hoist", "Scanner", "Hand tools"];
  const recordMs = [];
  for (let index = 1; index <= taskCount; index++) {
    await page
      .getByRole("radio", { name: stations[index % stations.length], exact: true })
      .press("Space");
    await page
      .getByRole("textbox", { name: "Operation", exact: true })
      .fill(`Synthetic operation ${index}`);
    await page
      .getByRole("radio", { name: types[index % types.length], exact: true })
      .press("Space");
    await page
      .getByRole("checkbox", { name: tools[index % tools.length], exact: true })
      .press("Space");
    await page
      .getByRole("textbox", { name: "Notes", exact: true })
      .fill(`Synthetic note ${index} with repeated realistic observation text`);
    started = performance.now();
    await page.getByRole("button", { name: "Record task", exact: true }).click();
    await page
      .getByRole("button", { name: `Task ${index + 1} in progress`, exact: true })
      .waitFor();
    recordMs.push(round(performance.now() - started));
  }

  // Measure a representative reload after the last commit has had a quiet turn,
  // rather than racing page teardown against the just-rendered subscription update.
  await page.waitForTimeout(500);
  started = performance.now();
  await page.reload();
  await page
    .getByRole("button", { name: `Task ${taskCount + 1} in progress`, exact: true })
    .waitFor();
  const populatedReloadMs = round(performance.now() - started);
  assert.equal(page.url(), runnerUrl);

  const editTask = Math.ceil(taskCount / 2);
  started = performance.now();
  await page.getByRole("button", { name: `Task ${editTask} completed`, exact: true }).click();
  await page.waitForFunction(
    (value) => document.querySelector('input[aria-label="Operation"]')?.value === value,
    `Synthetic operation ${editTask}`,
  );
  const openEditMs = round(performance.now() - started);
  await page
    .getByRole("textbox", { name: "Operation", exact: true })
    .fill(`Edited synthetic operation ${editTask}`);
  started = performance.now();
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await save.click();
  await save.waitFor({ state: "detached" });
  const saveEditMs = round(performance.now() - started);
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: `Task ${editTask} completed`, exact: true }).click();
  await page.waitForFunction(
    (value) => document.querySelector('input[aria-label="Operation"]')?.value === value,
    `Edited synthetic operation ${editTask}`,
  );
  const persisted =
    (await page.getByRole("textbox", { name: "Operation", exact: true }).inputValue()) ===
    `Edited synthetic operation ${editTask}`;
  const longTasks = await page.evaluate(() => window.__optioPerformance.longTasks);
  await context.close();
  return {
    scope:
      "Playwright action-to-observed UI commit wall time; includes automation overhead and is not INP",
    taskCount,
    startSessionMs,
    recordTask: summarize(recordMs),
    populatedReloadMs,
    openEditMs,
    saveEditMs,
    editPersistedAfterReload: persisted,
    finalReloadLongTasks: {
      count: longTasks.length,
      totalMs: round(longTasks.reduce((sum, task) => sum + task.durationMs, 0)),
      longestMs: round(Math.max(0, ...longTasks.map((task) => task.durationMs))),
    },
  };
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  const throttled = [];
  const unthrottled = [];
  for (let run = 0; run < runs; run++) throttled.push(await runStartup(browser, 250));
  for (let run = 0; run < runs; run++) unthrottled.push(await runStartup(browser, 0));
  const interaction = await runInteraction(browser);
  const result = {
    measuredAt: new Date().toISOString(),
    url: base,
    runs,
    throttle: {
      latencyMs: 250,
      downloadThroughput: "unlimited",
      uploadThroughput: "unlimited",
      scope:
        "CDP page-target network emulation; worker and service-worker internals may not share the throttle or appear in target byte totals",
    },
    startup: { throttled, unthrottled },
    interaction,
  };
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (output) await writeFile(output, json);
  console.log(json);
} finally {
  await browser.close();
}
