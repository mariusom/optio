# Development

Use Node.js 24 and the pnpm version in [package.json](../package.json), as CI does.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The dev server uses port 60001 and the `/optio/` path. In an Amp orb, run it as
a supervised service with a portal; see the [orb documentation](https://ampcode.com/docs/orbs).

Before submitting code changes:

```sh
pnpm exec playwright install chromium
pnpm check
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

On a fresh Linux host, use `playwright install --with-deps chromium` to install
system dependencies too. Other commands are in `package.json`.

## What tests establish

`pnpm test` runs unit tests followed by Chromium component tests;
`pnpm test:browser` runs only the latter. Session browser tests use the production
view and update loop but mock the LiveStore client. Agent CRUD tests use SQLite
with LiveStore's in-memory adapter and substitute browser registration and human
confirmation. Neither proves OPFS persistence, reload recovery, or native agent
compatibility. Verify those separately when changing storage or startup.

For interface changes, inspect affected states on phone, tablet and desktop,
including keyboard navigation and light/dark appearance. The screenshot helper
`node scripts/screenshots/tour.mjs /tmp/optio-tour` expects a production preview
on port 60002; set `OPTIO_URL` to override its base URL. Screenshots need inspection
and are not substitutes for assertions.

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

With the same preview running, `node scripts/test-startup.mjs` checks that default
startup skips optional style presets, failed downloads leave the app usable,
saved styles restore, and unused presets remain available offline. A failed
module download needs a page reload before retrying because browsers cache the
failure for the document's lifetime. `OPTIO_URL` overrides the preview URL.

## Dependencies and generated assets

- Keep Effect aligned with FoldKit and effect-machine's exact peer requirement.
  Keep Vitest and its browser provider aligned with the version bundled by Vite+.
- Registry components are project-owned copies. Review upstream changes before
  replacing them; preserve the [interface conventions](interface.md).
- Refresh component style presets with `node scripts/update-foldcn-styles.mjs`,
  then `pnpm exec vp fmt src/we/componentStyles.generated.ts`. The generator
  updates classes, not behavior or dependencies; it rejects ambiguous matches.
- Regenerate PNG app icons with `bun scripts/gen-icons.ts`.

## Deployment

[The workflow](../.github/workflows/deploy.yml) checks, tests and builds pushes
to `main`, then publishes `dist/` to GitHub Pages. The `/optio/` base path and
service-worker settings live in [vite.config.ts](../vite.config.ts). Test offline
behavior against a production build, not just the dev server.

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
