# Development

Use Node.js 24 and the pnpm version in [package.json](../package.json), as CI does.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The dev server uses port 60001 and the `/optio/` path.

Before submitting code changes:

```sh
pnpm exec playwright install chromium
pnpm check
pnpm exec tsc --noEmit
pnpm licenses:check
pnpm test
pnpm build
pnpm test:e2e
pnpm audit --audit-level high
```

On a fresh Linux host, use `playwright install --with-deps chromium` to install
system dependencies too. Other commands are in `package.json`.

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

Set `CHROME_PATH` if Chrome is not discovered automatically.
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
- The LiveStore adapter patch supplies `Schema.toCodecJson` to the worker RPC
  protocol expected by this Effect release. Remove it only when an upstream
  adapter includes the codec and the production storage journey passes.
- The scoped Nano ID override removes known advisories in LiveStore's pinned
  version. Reassess it when updating LiveStore. Keep the 24-hour release-age
  guard; do not bypass it for routine dependency updates.
- pnpm 12.4.0 is intentionally pinned from its `next-12` release track. Use the
  pinned version for its two-document lockfile. Verify external scanners and
  Dependabot parse the app graph, not only the package-manager document.
- Dependabot proposes grouped lockfile and GitHub Actions updates. Exact
  manifest pins and workspace overrides need deliberate coordinated updates.
  Audit includes development dependencies because they can affect shipped code.
- Registry components are project-owned copies. Review upstream changes before
  replacing them; preserve the [interface conventions](interface.md).
- Refresh component style presets with `node scripts/update-foldcn-styles.mjs`,
  then `pnpm exec vp fmt src/we/componentStyles.generated.ts`. The generator
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
subsequently redesigned. The public Git history retains that lineage.

## Public metadata and agent discovery

`index.html` contains static Open Graph metadata (Facebook, Reddit and other
link previews), X large-image card metadata, and WebApplication structured data.
Use `https://mariusom.github.io/optio/` when sharing. Hash routes and local study
IDs have no separate public previews; never put study data in social metadata.
The 1200×630 `public/social-card.png` is a typography-only sharing asset, not an
app screenshot. Keep its dimensions and alt text in sync with the HTML.

After `pnpm build`, run `node scripts/test-public-metadata.mjs`; it starts and
closes a temporary preview and also runs as part of `pnpm test:e2e`.
The check uses JavaScript-disabled
Chromium and verifies metadata, image dimensions, structured data, and deployed
discovery paths. `OPTIO_URL` overrides the preview URL. After deployment, use
Facebook's Sharing Debugger and X's card tools to request fresh previews where
available; platforms including Reddit may cache old previews or omit cards.

The app links to `llms.txt`, a public agent guide, a sitemap, and an AI Catalog
using `rel="ai-catalog"`. The catalog describes documentation, not a public MCP
server. Update the guide when the agent contract changes. Static Markdown is an
explicit alternative resource, not HTTP content negotiation.

GitHub Pages project sites cannot publish origin-root `robots.txt` or
`.well-known` files from this repository, or set arbitrary response headers.
Files under `/optio/` do not replace origin-root resources. Full control of
crawler policies and security headers requires control of the origin and a
host that supports those settings. A custom domain alone does not add header
configuration to GitHub Pages.

For tool usage, consult [Vite+](https://vite.plus),
[pnpm](https://pnpm.io), and [Vitest browser testing](https://vitest.dev/guide/browser/).

## Third-party source

The [architecture](architecture.md) describes the runtime libraries; the
[interface conventions](interface.md) describe the copied registry components.
[Third-party notices](../public/THIRD_PARTY_NOTICES.txt) preserve their applicable
license text and attribution and are copied into the production build. Keep
those notices when updating vendored code.

`pnpm licenses:generate` collects installed production dependency licenses and
notices, plus PWA/Workbox/Rollup distribution contributors, into that file and
[`dependency-inventory.json`](../public/dependency-inventory.json). Run it after
dependency updates and review the resulting diff. `pnpm licenses:check` tests
the collector and rejects unknown licenses, missing texts and artifact drift;
`pnpm build` also rejects drift. The service worker precaches both artifacts,
and the production E2E journey checks that they remain available offline.

The inventory is conservative, not a byte-level SBOM: the installed production
graph includes some server/build/type-only packages that do not reach browsers.
The current MPL-2.0 entry is Lightning CSS, a build tool, not a claim that the
app is MPL licensed. Dependencies and copied source keep their own licenses.
Review new bundle-generating tools and embedded assets manually; package
metadata cannot prove completeness or rights to historical contributions.
The gate does not detect new or changed copied source: reviewers must update
the copied-source provenance when refreshing registry components or adding
adapted code/assets, even if package checks pass.
Missing package license files require a version-scoped, reviewed fallback in
`licenses/reviewed-fallbacks` with provenance in the collector. Do not extend a
fallback to a new version without checking upstream. Do not edit generated
notices by hand. Keep the LiveStore patch's modification comments.

`cn` is the Shadcn class-merging package (`shadcn-ui/cn`). `tw-animate-css`
provides the imported components' composable enter/exit, fade, slide and zoom
utilities; Tailwind's built-in spin/pulse/bounce utilities do not replace them.

## Maintainer security and releases

Dependabot proposes updates Mondays at 09:00 Europe/London; review them weekly,
with critical security fixes handled immediately. Exact pins and overrides
still need deliberate updates. Verify compatibility with pnpm's two-document
lockfile using a successful lockfile-changing PR and a frozen install. A green
bot job alone does not prove that dependency updates work.

The security workflow adds PR/push CodeQL checks and Monday 08:00 UTC dependency
audits (including development dependencies). It never deploys. Check the first
GitHub runs after merging: local workflow linting cannot verify GitHub's security
permissions. Avoid enabling CodeQL default setup alongside this advanced
workflow. Review failed scheduled jobs and maintain security-alert notifications.

Repository administrators must enable private vulnerability reporting,
Dependabot alerts/security updates, secret scanning and push protection in
GitHub settings. Protect `main` with an active ruleset requiring PRs, `validate`,
up-to-date branches and resolved conversations, and blocking force pushes and
deletion. Use no bypass actors by default. Zero required approvals supports a
solo maintainer; require one independent approval when another reviewer is
available. Test a contributor PR before adding further required check names.
These are GitHub settings; committing workflow files does not enable them.

Deployment remains automatic after validated `main` pushes. A weekly maintenance
schedule is not a weekly publication schedule. The manual **Release assurance**
workflow is restricted to `main`: it validates, builds, packages `dist`, uploads
an archive and checksum, then attests that archive in a separate job. Build and
test steps have no attestation/OIDC write permissions. This workflow neither
deploys nor creates a tag or GitHub release. Do not dispatch it without intending
to publish the build artifact and provenance to GitHub.

For a release, record the tested commit, version, user-visible changes and data
compatibility caveats. Check offline updates, exports/recovery, keyboard access
and real target browsers. Never promise migrations or backups beyond what has
been tested. Download the archive and `SHA256SUMS` from the same successful
Release assurance run. Verify before extracting, replacing `<commit>` below
with that run's complete commit ID:

```sh
sha256sum --check SHA256SUMS
gh attestation verify "optio-dist-<commit>.tar.gz" --repo mariusom/optio
```

Check that the verification output identifies the expected workflow and source
commit. A matching checksum alone does not authenticate its author. Attestations
establish provenance, not safety, legal clearance, or native-style PWA signing;
the browser does not verify them when installing the website.
