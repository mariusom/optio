# Development

Use Node.js 24 and the pnpm version in [package.json](../package.json), as CI does.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The dev server uses port 60001 and the `/optio/` path. In an Amp orb, run it as
a supervised service with a portal; see the [orb documentation](https://ampcode.com/docs/orbs).

Use normal `pnpm dev` for remote previews: it opts into Vite's experimental
bundled-dev mode to avoid source-module request waterfalls. Source edits currently
full-reload without preserving FoldKit's in-memory Model, so unsaved input can
be lost. Use `pnpm dev --mode test` for the slower unbundled pipeline when testing
model-preserving reloads or plugin behavior. This uses the same pipeline as the
tests; it does not substitute mock study data. See the measured alternatives and
upstream discussions in [bundling research](dev-bundling-research.md).
A dev-only middleware works around Vite's non-root-base
lazy-import bug ([#23216](https://github.com/vitejs/vite/issues/23216)); remove it
when the upstream fix is available and the real dev-store check passes.

With the dev server running, `node scripts/measure-dev-load.mjs http://localhost:60001/optio/`
measures a fresh browser's usable session setup with disabled HTTP cache and
250 ms simulated network latency. It reports request timing and fails above
50 requests. Run `node scripts/test-dev-store.mjs http://localhost:60001/optio/`
to check sample creation and persistence after reload. Both scripts accept
`CHROMIUM_PATH` for an existing Chromium executable. These use disposable storage.

Before submitting code changes:

```sh
pnpm exec playwright install chromium
pnpm check
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm test:e2e
pnpm audit --audit-level high
```

On a fresh Linux host, use `playwright install --with-deps chromium` to install
system dependencies too. Other commands are in `package.json`.

## Lint limits and module size

`pnpm check` uses the Oxlint configuration in `vite.config.ts`, including in CI.
For a lint-only run, use `pnpm exec vp lint`. Hand-maintained production code
is limited to 500 lines per file, 150 lines per function (both exclude blanks
and comments), 25 statements per function, complexity 15, nesting depth 4,
three parameters and three nested callbacks. Imports must come first, be unique
and avoid cycles; side-effect imports are restricted to CSS and font assets.

Split by responsibility and pass related configuration as an object. Do not
hide positional parameters inside rest tuples or split code into numbered
fragments just to meet limits. Keep stateful subscription ownership explicit.

Tests and stories are exempt from size/complexity limits, including this repo's
`.browser.ts` and `.e2e.mjs` tests; all other rules still apply. The generated
style table is exempt only from file length. Effect's `_tag` discriminator is
allowed, and `openStore.ts` is exempt from `import/default` because Vite creates
the default constructors for its worker query imports. No blanket source or
registry-component exclusions are used.

## What tests establish

`pnpm test` runs unit tests followed by Chromium component tests;
`pnpm test:browser` runs only the latter. Session browser tests use the production
view and update loop but mock the LiveStore client. Agent CRUD tests use SQLite
with LiveStore's in-memory adapter and substitute browser registration and human
confirmation. Neither proves OPFS persistence, reload recovery, or native agent
compatibility.

`pnpm test:e2e` serves the production build on a temporary local port and uses
a disposable Chromium profile with real OPFS storage and workers. It records a
session, restarts the browser during an edit, cancels the edit, reloads offline,
ends the session and checks the downloaded CSV. No stored user data or
deployed service is used. Unit tests separately check deterministic event
replay. Native WebMCP integration and real Safari/mobile-device behavior still
need separate verification.

For interface changes, inspect affected states on phone, tablet and desktop,
including keyboard navigation and light/dark appearance. The screenshot helper
`node scripts/screenshots/tour.mjs /tmp/optio-tour` expects a production preview
on port 60002; set `OPTIO_URL` to override its base URL. Screenshots need inspection
and are not substitutes for assertions.

Set `OPTIO_SCREENSHOTS=/tmp/optio-e2e pnpm test:e2e` to capture recording,
results and export states during the production journey. Inspect captures
before publishing them; use synthetic data only.

## Performance audits

Audit a production build, not the dev server. With `pnpm build` complete and
`pnpm preview --port 60002` running, use:

```sh
pnpm dlx lighthouse@13.4.1 http://localhost:60002/optio/ --output=html --output-path=/tmp/optio-lighthouse.html
```

Set `CHROME_PATH` if Chrome is not discovered automatically. In an orb, use a
supervised preview service and add `--chrome-flags='--headless --no-sandbox'`.
Compare the same URL, browser and mobile throttling settings across repeated
cold runs; scores vary with host load. Startup changes must also preserve real
OPFS data across reloads and work offline after service-worker installation.

For repeatable application measurements, run:

```sh
node scripts/measure-production.mjs http://localhost:60002/optio/ /tmp/optio-performance.json
```

This uses disposable storage, three fresh-browser runs at 250 ms latency and
three unthrottled runs, service-worker-controlled reloads, and a 30-task
record/edit/reload journey. `OPTIO_PERF_RUNS`, `OPTIO_PERF_TASKS`, and
`CHROMIUM_PATH` override the defaults. It separates app render from usable
study controls and captures the request waterfall and main-thread long tasks.
Page-target CDP latency/byte totals do not fully cover workers or service-worker
precaching; interaction timings include Playwright overhead and are not INP.

The 2026-09-17 production baseline was about 0.69 s to render and 2.15 s to usable
controls at 250 ms latency, 0.19 s on a controlled reload, and 73 ms median to
record a task. Eager store loading and store-module preloading worsened cold
readiness to about 2.4 s; preloading Workbox did not reliably improve it. Those
experiments were reverted. Re-measure rather than treating these orb measurements
as mobile-device performance targets.

With the same preview running, `node scripts/test-startup.mjs` checks that default
startup skips optional style presets, failed downloads leave the app usable,
saved styles restore, and unused presets remain available offline. A failed
module download needs a page reload before retrying because browsers cache the
failure for the document's lifetime. `OPTIO_URL` overrides the preview URL.

## Dependencies and generated assets

- Keep Effect aligned with FoldKit and effect-machine's exact peer requirement.
  Keep Vitest and its browser provider aligned with the version bundled by Vite+.
  FoldKit 0.159.0 and its Vite plugin 0.21.0 are the newest releases compatible
  with effect-machine 0.37.0's Effect rc.112 requirement. FoldKit 0.160.0 needs
  rc.115; newer `@effect/vitest` releases need Vitest 5, while Vite+ 0.3.2
  still bundles Vitest 4.1.11. Upgrade these groups together when peers align.
- The LiveStore adapter patch supplies `Schema.toCodecJson` to the worker RPC
  protocol expected by this Effect release. Remove it only when an upstream
  adapter includes the codec and the production storage journey passes.
- The scoped Nano ID override removes known advisories in LiveStore's pinned
  version. Reassess it when updating LiveStore. Keep the 24-hour release-age
  guard; do not bypass it for routine dependency updates.
- pnpm 12.4.2 is pinned. Use the pinned version for its two-document lockfile.
  Verify external scanners and
  Dependabot parse the app graph, not only the package-manager document.
- Dependabot proposes grouped lockfile and GitHub Actions updates. Exact
  manifest pins and workspace overrides need deliberate coordinated updates.
  Audit includes development dependencies because they can affect shipped code.
- Registry components are project-owned copies. Review upstream changes before
  replacing them; preserve the [interface conventions](interface.md).
- Refresh component style presets with `node scripts/update-foldcn-styles.mjs`,
  then `pnpm exec vp fmt src/web/componentStyles.generated.ts`. The generator
  updates classes, not behavior or dependencies; it rejects ambiguous matches.
- Regenerate PNG app icons with `bun scripts/gen-icons.ts`.

## Deployment

[The workflow](../.github/workflows/deploy.yml) audits, checks, tests and builds
pull requests and pushes to `main`. Only validated `main` builds can reach the
separate GitHub Pages deployment job; install and test steps have no Pages or
OIDC write permissions. The `/optio/` base path and service-worker settings live
in [vite.config.ts](../vite.config.ts).

The current pre-release starts a fresh `optio-v3` store and does not migrate
older stores. Export any wanted pre-release results using the old build before
updating. Once data compatibility is promised, treat event and table changes as
migrations rather than renaming the store.

## CSV exports

The interface has one **Export CSV** action. It automatically prefixes
formula-like headings and values with an apostrophe inside a quoted cell.
This changes those exported cells, not stored observations; scripts reading
the CSV may see the added apostrophe.
It covers leading formula characters, their full-width variants, and leading
whitespace/control characters that can hide a formula.

No CSV mitigation is universal across spreadsheet applications. Re-saving can
remove protection; see [OWASP's CSV guidance](https://owasp.org/www-community/attacks/CSV_Injection).
Existing agent export actions remain raw unless `spreadsheetSafe: true` is set.

## Project history

Optio began as a web implementation of an earlier Swift time-study app and was
subsequently redesigned. The public Git history retains that lineage. New
commit messages should describe the outcome and important tradeoffs, not
private spec section numbers or tool transcripts.

## Public metadata and agent discovery

`index.html` contains static Open Graph metadata (Facebook, Reddit and other
link previews), X large-image card metadata, and WebApplication structured data.
Use `https://mariusom.github.io/optio/` when sharing. Hash routes and local study
IDs have no separate public previews; never put study data in social metadata.
The 1200×630 `public/social-card.png` is a typography-only sharing asset, not an
app screenshot. Keep its dimensions and alt text in sync with the HTML.

After `pnpm build`, start `pnpm preview --port 60002` and run
`node scripts/test-public-metadata.mjs`. The check uses JavaScript-disabled
Chromium and verifies metadata, image dimensions, structured data, and deployed
discovery paths. `OPTIO_URL` overrides the preview URL. After deployment, use
Facebook's Sharing Debugger and X's card tools to request fresh previews where
available; platforms including Reddit may cache old previews or omit cards.

The app links to `llms.txt`, a public agent guide, a sitemap, and an AI Catalog
using `rel="ai-catalog"`. The catalog describes documentation, not a public MCP
server. Update the guide when the agent contract changes. Static Markdown is an
explicit alternative resource, not HTTP content negotiation.

The 2026-09-10 isitagentready.com baseline for the live app was 0 (default scan).
Most checks use `https://mariusom.github.io/`, not the `/optio/` project path.
This repository cannot publish origin-root `robots.txt` or `.well-known` files,
control `github.io` DNS, or set production Link/Vary headers. Putting those files
under `/optio/` would not satisfy origin-root discovery. The linked catalog can
be discovered from the page without root access, but a new score must be measured
after deployment; local validation is not a scanner score.

For further applicable score gains, an origin-root site or custom-domain hosting
decision is required. Publish root `robots.txt` with an explicit owner-approved
AI crawler/content-use policy and the sitemap URL; configure real Link headers
and `Accept: text/markdown` negotiation with `Vary: Accept` on a host supporting
them. Rescan the same URL with the same checks. Do not add fake OAuth, commerce,
MCP server cards, or disable WebMCP consent to satisfy the scanner. Its page-load
`navigator.modelContext` probe differs from Optio's opt-in `document.modelContext`
integration. A high protocol-discovery score is not a security or usability audit.

For tool usage, consult [Vite+](https://vite.plus),
[pnpm](https://pnpm.io), and [Vitest browser testing](https://vitest.dev/guide/browser/).

## Third-party source

The [architecture](architecture.md) describes the runtime libraries; the
[interface conventions](interface.md) describe the copied registry components.
[Third-party notices](../public/THIRD_PARTY_NOTICES.txt) preserve their applicable
license text and attribution and are copied into the production build. Keep
those notices when updating vendored code.
