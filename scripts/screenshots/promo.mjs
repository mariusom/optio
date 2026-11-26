// README motion piece: the real production app, driven by script inside a
// branded stage, captured frame by frame and encoded as an animated WebP.
// Usage: pnpm build && node scripts/screenshots/promo.mjs [docs/images]
// Writes promo.webp (animated) and promo-still.webp (reduced-motion poster).
// Needs ffmpeg with libwebp. Frames use the default sans-serif font; the
// committed capture used Inter installed as the system sans (fontconfig).
// Study data is synthetic: a restored backup with fixed timings, plus the
// live session the script records.
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite-plus";

const out = process.argv[2] ?? "docs/images";
const [width, height] = [1600, 900];
const sessionId = "promo-session";
const minute = 60_000;
const start = Date.UTC(2026, 10, 24, 7, 30);

// A morning on line 3: (station, task type, minutes, tools, interrupted).
const observations = [
  ["Station 2", "Setup", 6, "Hand tools", "false"],
  ["Station 2", "Value-added", 14, "Torque driver", "false"],
  ["Station 3", "Walking", 3, "None", "false"],
  ["Station 3", "Value-added", 11, "Torque driver,Scanner", "false"],
  ["Station 3", "Waiting", 7, "None", "true"],
  ["Station 4", "Value-added", 16, "Hoist", "false"],
  ["Station 4", "Inspection", 5, "Scanner", "false"],
  ["Rework", "Rework", 8, "Hand tools", "true"],
  ["Station 5", "Walking", 4, "None", "false"],
  ["Station 5", "Value-added", 12, "Torque driver", "false"],
  ["Station 5", "Waiting", 6, "None", "false"],
  ["Station 2", "Value-added", 10, "Torque driver", "false"],
];
const operations = ["Fit bracket", "Torque bolts", "Fetch panels", "Mount panel", "Wait for parts"];

const backup = () => {
  let at = start;
  const records = observations.map(([station, type, minutes, tools, interrupted], index) => {
    const startedAt = at;
    at += minutes * minute;
    const section = ([sectionName, value, sectionType, isRequired]) => ({
      sectionName,
      value,
      sectionType,
      isRequired,
      startedAt,
    });
    return {
      taskIdNumber: index + 1,
      taskType: "single",
      startedAt,
      endedAt: at,
      sections: [
        section(["Station", station, "radio", true]),
        section(["Operation", operations[index % operations.length], "textInput", true]),
        section(["Task type", type, "radio", true]),
        section(["Tools used", tools, "checkbox", false]),
        section(["Interrupted", interrupted, "boolean", false]),
        section(["Notes", "", "textArea", false]),
      ],
    };
  });
  return {
    format: "optio-backup",
    version: 1,
    exportedAt: at,
    templates: [],
    sessions: [
      {
        id: sessionId,
        templateId: null,
        templateName: "Assembly line",
        sessionName: "Line 3 · Morning shift",
        startedAt: start,
        endedAt: at,
        records,
      },
    ],
  };
};

const stage = (base) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  :root { --ink: #14150f; --muted: #5d5f57; --paper: #f4f5f1; }
  * { box-sizing: border-box; margin: 0; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; background: var(--paper);
    color: var(--ink); font-family: system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .brand { position: absolute; left: 120px; top: 84px; font-size: 30px; font-weight: 600;
    letter-spacing: -0.02em; transition: opacity .6s; }
  .scene { position: absolute; left: 120px; top: 50%; width: 640px; transform: translateY(-46%);
    opacity: 0; transition: opacity .35s ease, transform .35s ease; }
  /* The outgoing caption fades first, so two never overlap. */
  .scene.on { opacity: 1; transform: translateY(-50%); transition-duration: .6s; transition-delay: .35s; }
  .step { font-size: 18px; font-weight: 600; color: var(--muted); letter-spacing: .08em; margin-bottom: 20px; }
  h1 { font-size: 64px; line-height: 1.04; letter-spacing: -0.035em; font-weight: 650; }
  h1.big { font-size: 92px; }
  p { margin-top: 24px; font-size: 26px; line-height: 1.4; color: var(--muted); max-width: 30ch; }
  .chips { display: flex; gap: 28px; margin-top: 40px; font-size: 22px; }
  .device { position: absolute; opacity: 0; pointer-events: none; transition: opacity .7s ease, transform .7s ease; }
  .device.on { opacity: 1; transform: none; pointer-events: auto; }
  .phone { right: 190px; top: 62px; width: 366px; height: 776px; padding: 11px;
    border-radius: 56px; background: #16171a;
    box-shadow: 0 40px 80px -30px rgb(20 21 15 / .45), 0 0 0 1px rgb(0 0 0 / .08);
    transform: translateY(40px); }
  .phone iframe { width: 390px; height: 832px; border: 0; border-radius: 46px;
    transform: scale(.885); transform-origin: 0 0; background: #fff; }
  .laptop { right: 64px; top: 120px; width: 940px; height: 660px; border-radius: 14px; overflow: hidden;
    background: #fff; box-shadow: 0 40px 80px -30px rgb(20 21 15 / .4), 0 0 0 1px rgb(0 0 0 / .1);
    transform: translateX(60px); }
  .laptop .bar { height: 32px; background: #ececea; display: flex; gap: 8px; align-items: center; padding: 0 14px; }
  .laptop .bar i { width: 11px; height: 11px; border-radius: 50%; background: #cfcfcb; }
  .laptop iframe { width: 1120px; height: 748px; border: 0; transform: scale(.8393); transform-origin: 0 0; }
  .tap { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
    background: rgb(20 21 15 / .28); pointer-events: none; animation: tap .6s ease-out forwards; }
  @keyframes tap { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
</style></head><body>
  <div class="brand" id="brand">optio</div>
  <section class="scene" id="s0"><h1 class="big">See where your time goes.</h1>
    <p>Time and motion studies that run in your browser, on any device.</p></section>
  <section class="scene" id="s1"><div class="step">01 · SET UP</div><h1>Start a study in seconds.</h1>
    <p>Pick a template of questions, name the session and go.</p></section>
  <section class="scene" id="s2"><div class="step">02 · OBSERVE</div><h1>Tap what you see. Record. Repeat.</h1>
    <p>Large targets, a running timer and every task saved as you work, even offline.</p></section>
  <section class="scene" id="s3" style="width:500px"><div class="step">03 · REVIEW</div><h1>Find the time that matters.</h1>
    <p>Each session breaks down by answer, ready to export as CSV.</p></section>
  <section class="scene" id="s4"><h1 class="big">optio</h1>
    <p>Free and open source. No account. Your studies stay on your device.</p>
    <div class="chips"><span>Works offline</span><span>·</span><span>mariusom.github.io/optio</span></div></section>
  <div class="device phone" id="phone"><iframe id="phoneFrame" src="${base}#/start"></iframe></div>
  <div class="device laptop" id="laptop"><div class="bar"><i></i><i></i><i></i></div>
    <iframe id="laptopFrame"></iframe></div>
<script>
  window.show = (scene, device) => {
    for (const s of document.querySelectorAll(".scene")) s.classList.toggle("on", s.id === scene);
    for (const d of ["phone", "laptop"]) document.getElementById(d).classList.toggle("on", d === device);
    document.getElementById("brand").style.opacity = scene === "s4" ? 0 : 1;
  };
  window.tap = (x, y) => {
    const dot = Object.assign(document.createElement("div"), { className: "tap" });
    dot.style.left = x + "px"; dot.style.top = y + "px";
    document.body.append(dot); setTimeout(() => dot.remove(), 700);
  };
</script></body></html>`;

const server = await preview({ preview: { host: "127.0.0.1", port: 0, open: false } });
const base = `http://127.0.0.1:${server.httpServer.address().port}/optio/`;
const frames = await mkdtemp(join(tmpdir(), "optio-promo-"));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: "light",
    serviceWorkers: "block",
  });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage();

  // Restore the synthetic history through Settings, as a user would.
  await page.goto(`${base}#/settings`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "optio-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup())),
  });
  await page.getByText(/Restored 0 templates and 1 session/).waitFor();

  await page.route(`${base}__promo.html`, (route) =>
    route.fulfill({ contentType: "text/html", body: stage(base) }),
  );
  await page.goto(`${base}__promo.html`);
  const phone = page.frameLocator("#phoneFrame");
  const laptop = page.frameLocator("#laptopFrame");
  await phone.getByRole("button", { name: "Start Session" }).waitFor();

  // Capture continuously while the scenes play; each frame keeps its own duration.
  const shots = [];
  const state = { capturing: true };
  const capture = (async () => {
    while (state.capturing) {
      const path = join(frames, `${String(shots.length).padStart(4, "0")}.png`);
      await page.screenshot({ path });
      shots.push({ path, at: performance.now() });
    }
  })();
  const wait = (ms) => page.waitForTimeout(ms);
  const tapOn = async (locator, action = (l) => l.click()) => {
    const box = await locator.boundingBox();
    await page.evaluate(
      ([x, y]) => window.tap(x, y),
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    await wait(180);
    await action(locator);
    await wait(420);
  };
  const choose = (frame, role, name) =>
    tapOn(frame.getByRole(role, { name, exact: true }).first(), (l) => l.press("Space"));
  const type = async (frame, name, text) => {
    const field = frame.getByRole("textbox", { name, exact: true }).first();
    await tapOn(field, (l) => l.focus());
    await field.pressSequentially(text, { delay: 55 });
  };

  let stillAt = 0;
  try {
    await page.evaluate(() => window.show("s0", null));
    await wait(3200);
    await page.evaluate(() => window.show("s1", "phone"));
    await wait(1400);
    await type(phone, "Session name", "Line 3 · Afternoon");
    await wait(300);
    await tapOn(phone.getByRole("button", { name: "Start Session" }));
    await phone.getByRole("textbox", { name: "Operation", exact: true }).waitFor();
    await page.evaluate(() => window.show("s2", "phone"));
    await wait(1200);
    await choose(phone, "radio", "Station 2");
    await type(phone, "Operation", "Torque bolts");
    await choose(phone, "radio", "Value-added");
    await choose(phone, "checkbox", "Torque driver");
    await wait(300);
    stillAt = shots.length;
    await tapOn(phone.getByRole("button", { name: "Record task" }));
    await wait(900);
    await choose(phone, "radio", "Station 3");
    await type(phone, "Operation", "Fetch panels");
    await choose(phone, "radio", "Walking");
    await wait(1600);
    // Optio holds one tab lock per store, so the desktop frame opens only once
    // the phone frame has closed.
    await page.evaluate(() => window.show("s3", null));
    await page.evaluate((url) => {
      document.getElementById("phoneFrame").src = "about:blank";
      setTimeout(() => (document.getElementById("laptopFrame").src = url), 300);
    }, `${base}#/history/${sessionId}`);
    await laptop.getByText("Time breakdown", { exact: true }).first().waitFor();
    await page.evaluate(() => window.show("s3", "laptop"));
    await wait(1800);
    const breakdown = laptop.getByText("Time breakdown", { exact: true }).first();
    await breakdown.evaluate((node) => node.scrollIntoView({ behavior: "smooth", block: "start" }));
    await wait(3800);
    await page.evaluate(() => window.show("s4", null));
    await wait(3200);
  } finally {
    state.capturing = false;
    await capture;
  }

  // Durations from capture times; the last frame holds briefly before the loop.
  const list = shots
    .map((shot, index) => {
      const next = shots[index + 1]?.at ?? shot.at + 1000;
      return `file '${shot.path}'\nduration ${((next - shot.at) / 1000).toFixed(3)}`;
    })
    .join("\n");
  await writeFile(join(frames, "list.txt"), `${list}\nfile '${shots.at(-1).path}'\n`);
  await mkdir(out, { recursive: true });
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    join(frames, "list.txt"),
    "-vf",
    "fps=12,scale=1200:-1:flags=lanczos",
    "-c:v",
    "libwebp_anim",
    "-lossless",
    "0",
    "-quality",
    "72",
    "-compression_level",
    "6",
    "-loop",
    "0",
    join(out, "promo.webp"),
  ]);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    shots[stillAt].path,
    "-vf",
    "scale=1200:-1:flags=lanczos",
    "-quality",
    "85",
    join(out, "promo-still.webp"),
  ]);
  console.log(`Wrote ${join(out, "promo.webp")} (${shots.length} frames) and promo-still.webp`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
  if (!process.env.OPTIO_PROMO_KEEP) await rm(frames, { recursive: true, force: true });
  else console.log(`Frames kept in ${frames}`);
}
