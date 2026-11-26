// Lighthouse on the production build (mobile, simulated throttling). Run after pnpm build.
// Lighthouse runs through a pinned `pnpm dlx`, not a dev dependency: its ~90
// packages would join the app's lockfile, audit and type graph (they broke
// ES2023 lib resolution in the TSRS check) for a tool that ships nothing.
// Accessibility, best practices and SEO must score 100 on the main screens;
// performance is reported, and fails only below a loose floor, because
// shared CI runners make it noisy.
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";
import { preview } from "vite-plus";

const lighthouseVersion = "13.6.0";
const strict = ["accessibility", "best-practices", "seo"];
const performanceFloor = 0.8;
const screens = ["start", "templates", "history", "settings"];

const freePort = () =>
  new Promise((resolve) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

void test("Lighthouse scores on the main screens", { timeout: 300_000 }, async () => {
  const server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/optio/`;
  const port = await freePort();
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
  const failures = [];
  const rows = [];
  try {
    for (const screen of screens) {
      const { stdout } = await promisify(execFile)(
        "pnpm",
        [
          "dlx",
          `lighthouse@${lighthouseVersion}`,
          `${base}#/${screen}`,
          `--port=${port}`,
          `--only-categories=${[...strict, "performance"].join(",")}`,
          "--output=json",
          "--output-path=stdout",
          "--quiet",
        ],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      const { categories, audits } = JSON.parse(stdout);
      rows.push(
        `${screen.padEnd(10)} ${Object.values(categories)
          .map((category) => `${category.id} ${Math.round(category.score * 100)}`)
          .join(", ")}`,
      );
      for (const id of strict) {
        if (categories[id].score === 1) continue;
        const failing = categories[id].auditRefs
          .filter((ref) => ref.weight > 0 && audits[ref.id].score !== null)
          .filter((ref) => audits[ref.id].score < 1)
          .map((ref) => `${ref.id} (${audits[ref.id].title})`);
        failures.push(`${screen} ${id} ${categories[id].score}: ${failing.join(", ")}`);
      }
      if (categories.performance.score < performanceFloor) {
        failures.push(
          `${screen} performance ${categories.performance.score} < ${performanceFloor}`,
        );
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
  console.log(rows.join("\n"));
  assert.deepEqual(failures, [], failures.join("\n"));
});
