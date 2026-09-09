# optio

A fully offline **time & motion study** recorder — a standalone local-first
web app. No server, no sync, no account: every observation is written to a
local SQLite database persisted in **OPFS**, so it survives reloads,
background kills and airplane mode.

Installable as a home-screen app; hardening for standalone-PWA constraints
(viewport/safe-area/UI chrome) is a first-class concern (see below).

## What it does

- **Templates** — the questions asked for every task: text, long text, single
  choice, multiple choice (with choices that clear the others, e.g. "None"),
  and Yes/No. Questions can be required, given a default answer, reordered and
  renamed; templates can be duplicated, set as default and deleted. Three
  sample templates ("Assembly line", "Ward round", "Warehouse pick") are seeded
  on first launch and can be re-added any time from the Templates screen.
- **Sessions** — pick a template, name the session (or accept a random
  two-word name), and record observations. Each task is one filled form; the
  first value written stamps `startDate` (SQL `COALESCE(startDate, now)`), and
  task/session durations are derived from it. Sessions can be resumed after a
  force-quit or a reload — the live session row _is_ the resume state.
- **Phone + tablet/desktop** — one phone-first layout: bottom tab bar and a
  single-column form on `<768px`; a sidebar rail on tablets and a labeled
  sidebar at `≥1280px`. The live session adds a task column beside the form at
  `≥768px`. The tab bar is hidden during a live session, where a navigation
  bar with the timer and a full-width Record button take over.
- **History** — archived sessions with full task/section detail, editable
  session names, delete confirmation, and **CSV export** per session in both
  export formats (live per-option expanded columns, archive alphabetical
  union), downloaded as `optio_<name>_<yyyy-MM-dd_HH-mm-ss>.csv`.
- **Fully offline** — the whole app is a service-worker-precached PWA; there
  is no network dependency at runtime.

## Stack

| Layer              | Tool                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| UI framework       | [FoldKit](https://foldkit.dev) 0.158 — Elm architecture on Effect (Model / Message / update / view)                                        |
| Styling            | Tailwind CSS 4 + [Foldcn](https://foldcn.elianiva.com) / `@foldkit/ui` registry components, with optio's app primitives on top (see below) |
| Local-first data   | [LiveStore](https://livestore.dev) `0.5.0-dev.0` — reactive SQLite (WASM) in a worker, OPFS-persisted, store id `optio-v1`                 |
| Session logic      | `@typeonce/effect-machine` 0.34 — declarative statechart (Idle → Live { Collecting \| ConfirmingEnd }), planned synchronously              |
| Runtime validation | Effect `4.0.0-rc.112` Schema (`decodeUnknownEffect` before every commit)                                                                   |
| Toolchain          | [Vite+](https://vite.plus) (`vp`) — dev server, Rolldown build, oxlint, oxfmt, type check, Vitest in one binary                            |
| PWA                | `vite-plugin-pwa` (`generateSW`, autoUpdate) + Workbox (confirmed-refresh update toast)                                                    |
| Package manager    | pnpm 12.4.0 (workspace `minimumReleaseAge: 1440` supply-chain guard)                                                                       |
| Hosting            | GitHub Pages (static SPA + service worker, served under `/optio/`)                                                                         |

## Standalone-PWA hardening

- `h-dvh` root shell, `html, body { height: 100%; overflow: hidden }` and
  delegated scrolling to `<main>` (no toolbar-driven jumps).
- `text-base` on all mobile inputs/textareas (no auto-zoom), `appearance:
none` on form controls, transparent `-webkit-tap-highlight-color`.
- `overscroll-behavior-y: contain` + `-webkit-overflow-scrolling: touch` on
  scrollable regions; `env(safe-area-inset-*)` on header, tab bar and modals.
- `focus-visible`-only focus rings, decorative icons hidden from assistive
  technology, and reduced-motion support.
- PWA manifest with PNG icons (192/512 + maskable) and a home-screen icon;
  service worker updates never reload the page under you — an unobtrusive
  "Update available — tap to refresh" toast asks first.

## Commands

```sh
pnpm install         # install dependencies
pnpm dev             # dev server (vp dev) → http://localhost:60001
pnpm build           # production build (vp build) → dist/
pnpm check           # oxfmt + oxlint + type checks in one shot
pnpm test            # vitest via vp test
pnpm preview         # preview the production build
bun scripts/gen-icons.ts             # regenerate public/icon-{180,192,512}.png
node scripts/screenshots/tour.mjs /tmp/tour   # screenshot every screen (needs `pnpm preview --port 60002`)
```

## Design language

optio uses Foldcn's neutral light/dark theme and Tailwind v4's spacing scale.
The layout stays phone-first, centered on tablets and desktops:

- **Shell** — large-title page headers on the four tab roots, a bottom tab bar
  on phones and a sidebar (icon rail on tablets, labeled column on wide
  screens) at `≥768px`. Pushed screens (template editor, session detail, live
  session) draw one 44pt navigation bar with a back link that looks identical
  at every size, so nothing rearranges between breakpoints.
- **Content** — bordered grouped lists with sentence-case section headers and muted
  footers, 44pt rows, checkmarks for selection, chevrons for navigation, one
  full-width primary action per screen, destructive actions in red and always
  confirmed in a sheet.
- **Sheets** — bottom sheets on phones, centered cards on larger screens, for
  every modal (create, rename, confirm, task details, per-row actions). A small
  document-level focus manager (`src/we/sheetFocus.ts`) moves focus into an
  open sheet, keeps it there, and returns it to the opener on close.
- **Copy** — plain language only: "question", "answer type", "choices",
  "must be answered", "Yes/No". Failures are one short sentence; the technical
  cause goes to the console, never to the screen.
- **Forms** — associated labels, 16px inputs on phones, `autocapitalize`,
  `enterkeyhint`, autofocus on the first field of a sheet, and a hint under any
  disabled primary button that says what is missing.
- **Lazy lists** — long lists (history, tasks, questions) use
  `content-visibility: auto` rows so off-screen rows cost nothing to render.

## Component layers

Two layers, both TypeScript view functions for Foldkit (no React):

1. **`src/components/ui/*`** — [Foldcn](https://foldcn.elianiva.com) registry
   items owned by this project, following shadcn's copy-and-customize approach.
   `components.json` registers `@foldcn` and maps the `@/components`,
   `@/components/ui`, `@/lib` and `@/hooks` aliases. Add or refresh items with
   the namespaced registry names:

   ```sh
   npx shadcn@latest add @foldcn/button @foldcn/sheet
   ```

   Installed: button, input, textarea, switch, checkbox, radio-group,
   native-select, badge, card, item, empty, label, separator, skeleton,
   progress, dialog, sheet, alert-dialog. Review before overwriting: button,
   input, native-select, textarea and switch have shared app sizing defaults.
   Buttons expose `buttonClass` for links and `data-size` for inspection.
   Stateful items (dialog, sheet, alert-dialog, radio-group) are Foldkit
   submodels; the app currently uses the pure-view items plus its own
   pure-view sheet (below).

2. **`src/components/app/*`** — optio's own primitives composed from the
   Foldcn layer and Tailwind tokens: `tabBar`, `sidebar`, `navBar`,
   `navBarAction`, `pageHeader`, `page`, `groupedList`, `row`,
   `controlRow`, `statusPill`, `sheet`, `confirmSheet`, `emptyState`,
   `notice`, `hint`, and lucide `icon`. Every screen is built from these; no
   screen-specific CSS classes exist.

`src/index.css` keeps `@import "tailwindcss";`, the Foldcn `:root`/`.dark`
tokens (dark mode follows the system unless overridden in Settings), the
standalone-PWA hardening rules and a handful of `@utility` helpers
(`pt-safe`, `pb-safe`, `px-safe`, `lazy-row`).

Settings offers Foldcn's Default (Nova), Nova, Vega, Maia, Lyra, Mira, Luma,
Sera and Rhea component styles independently of Light/Dark/Automatic appearance.
The style is saved locally as `optio-foldcn-style`. These are component-class
presets, not separate color palettes. Optio's app-owned navigation and grouped
lists keep their layout; registry components use the selected preset while
retaining the app's touch sizing and accessibility customizations.

Refresh the installed components' style table with:

```sh
node scripts/update-foldcn-styles.mjs
pnpm exec vp fmt src/we/componentStyles.generated.ts
```

The generator reads all eight resolved registries, matches named class constants
and variant entries, and fails on missing/ambiguous matches. It updates styles,
not component behavior or dependencies; review registry source changes separately.
Default/Nova retains Optio's owned defaults. Other styles use upstream radii.

### Shared sizing contract

- Use Tailwind's `--spacing` scale (`gap-2`, `p-4`, `p-6`), semantic colors,
  and `rounded-md`/`rounded-lg` derived from Foldcn's `--radius` token.
- Default buttons and single-line fields are `h-11`; large buttons are `h-12`.
  Button horizontal padding grows from `px-4` to `px-6`; fields use `px-3`.
  These rem-based sizes scale with the root font. Compact registry sizes remain
  available for dense interfaces; primary app controls retain 44px touch targets.
- Page gutters use four spacing units on phones and six at `md`; sheets use
  `p-6`, grouped controls `p-4`, and page sections `gap-6`.
- Pages may constrain layout (`w-full`, `flex-1`) but must not override primitive
  heights, padding, radii, colors or typography. Use existing semantic variants.
  A new variation belongs in a shared component only when multiple consumers
  need it; a one-off visual exception is not a reason to add a variant.
- `statusPill` composes the registry badge; navigation and sheet actions reuse
  the button primitive; empty states use the registry Empty defaults.

The base registry currently requests Effect `4.0.0-rc.109`; this app keeps
`4.0.0-rc.112` to match its existing stack. Check dependency changes after any
registry update. Run `pnpm check`, `pnpm exec tsc --noEmit`, `pnpm test`, and
`pnpm build` after adding or updating components.

The session machine uses `Machine.targets` for typed destinations, direct
`{ target }` / `{ update, decoded }` declarations for pure transitions, and
named `branches` with `resolve(context, enqueue)` for conditional routing or
store-command emissions. `from` and `decoded` constructors cannot emit commands.
Owner-only updates preserve the active collecting/confirmation phase.

Keep Vitest and its browser provider at `4.1.11` while Vite+ `0.3.1` bundles that
version; Vitest 5 is not compatible with this toolchain. Effect remains pinned
to `4.0.0-rc.112`, the exact peer required by FoldKit and effect-machine.

## Keyboard regression tests

Install Chromium once with `pnpm exec playwright install chromium` (on a fresh
Linux CI host, use `pnpm exec playwright install --with-deps chromium`).
`pnpm test` runs the unit suite followed by the Chromium component suite;
`pnpm test:browser` runs only the latter.

The browser tests mount the production responsive session view in Foldkit and
dispatch through the production `update`/session machine. They cover radio
selection, Space, all four arrow keys with wrapping, forward/backward Tab,
independent mobile/tablet native groups, and collapsed/expanded sidebar focus
and Chromium accessibility-tree exposure at 390, 820, and 1440px as applicable.

These are component tests, **not LiveStore persistence end-to-end tests**:
the OPFS/worker client is mocked, emitted `UpdateFieldValue` command arguments
are checked, and store snapshots are simulated through production `GotRunnerData`.
The production focused-section scroll subscription remains enabled. They do not
prove worker startup, persistence, reload recovery, or asynchronous store timing.
Section, switch and scroll-anchor IDs and radio `name` values are independently
scoped to avoid conflicts between responsive copies. Scroll subscriptions target
the visible copy. The deployment workflow installs Chromium and its Linux
dependencies and runs checks, typechecking and both test suites before building.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with
Vite+ and publishes `dist/` to GitHub Pages. The app is served under `/optio/`
(`base` in `vite.config.ts`) and is fully usable offline after the first
visit thanks to the generated service worker.

## Local data

Everything lives in the browser: LiveStore → SQLite (WASM) → OPFS. The store
id is `optio-v1` — earlier store versions are deliberately incompatible and
ignored. There is intentionally no sync and no backend.

## Agent access: WebMCP and MCP

WebMCP works on static hosting, including GitHub Pages. In a browser/agent
supporting the current `document.modelContext` API, open the app with
`?agentTools=1` **before the hash route**, then accept the native consent dialog.
For example, after deploying this version: `/optio/?agentTools=1#/templates`.
Without the flag, consent, or API support, no tools are registered and the app
continues normally. Remove the flag and reload to revoke access.

**This is full access to existing app operations and loaded study data, not
read-only access.** An agent provider may send returned data to a cloud model.
Optio itself adds no network requests, model API key, server or sync. Only enable
access with an agent you trust. WebMCP remains experimental; browser flags or an
origin trial may be needed. No polyfill or origin-trial token is bundled.

The shared Effect `Tool`/`Toolkit` implementation is in `src/agents/tools.ts`:

| Tool                        | Purpose                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `optio_list_templates`      | Paginated local template IDs, names and defaults                                                                             |
| `optio_list_sessions`       | Paginated archived session summaries                                                                                         |
| `optio_get_session_summary` | Timestamps, elapsed duration and task count for one archive                                                                  |
| `optio_get_state`           | Current app state, including editor drafts, live observation values, loaded archive detail, errors and pending confirmations |
| `optio_action`              | One schema-validated user action through the real Foldkit update loop                                                        |

List tools accept optional `offset` (default 0) and `limit` (default 50, maximum
100). `optio_action` takes `{ "action": { "_tag": "…", ... } }`; its generated
input schema enumerates the supported actions. This exposes:

- Templates: create, open, rename, duplicate, set default and delete.
- Fields/options: add, edit, remove and reorder; changes remain editor drafts
  until `ClickedSaveTemplate`.
- Sessions: start, resume, rename archives, end/archive, discard live sessions
  and delete archives.
- Observations: read, fill, record, select completed live tasks, edit, save and
  cancel edits. Archived observation values remain immutable, as in the UI;
  deleting an archived session removes its observations.
- Archive detail, CSV downloads, navigation and theme settings.

For example, create a template by sending `ClickedNewTemplate`,
`ChangedNewName` with `text`, then `ConfirmedCreateTemplate`. Open its ID with
`ClickedTemplateRow`. Navigate using
`{ "_tag": "Navigate", "route": { "_tag": "TemplatesTab" } }` rather than URLs.
Internal store snapshots and completion messages cannot be sent as actions.

Action replies describe the immediate update result: `changed`, `state` and
`pendingCommands` (the number of commands dispatched by **that action**).
They do **not** promise that asynchronous writes have finished. Read state until
the expected data or error appears before proceeding; a subsequent read's zero
`pendingCommands` is not a global idle signal. Do not blindly retry creation,
recording or deletion after a timeout. Cancellation stops waiting, not an already
dispatched write. Recording and field changes use the same timestamp rules as
the UI and can affect study measurements.

Destructive confirmations require a separate human browser confirmation as well
as the app's request/confirm workflow. Deletion labels come from application
state, not agent-supplied names; the browser confirmation includes the target ID.
Approval carries an internal confirmation version checked and consumed atomically
by the update loop. Target changes, cancellation and prior confirmations invalidate
it, including changes made by another connection or the UI. A stale approval
dispatches no destructive command and requires confirmation again. Unnamed archives
use the same display-name fallback as the history list.
Tool annotations are hints, not permission checks. Invalid field kinds, option
indices, selected values and foreign task field IDs are rejected at the agent
boundary. ID-specific navigation requires an existing template/archive, and only
the active session can be opened in the runner.

WebMCP returns expected failures as `{ "isError": true, "error": { "message": "…" } }`
so validation, refusal and timeout messages survive native error handling.
Successful results keep the shapes described above. Cancellation and unexpected
defects still reject execution; ordinary MCP uses its protocol-native errors.

`src/agents/webmcp.ts` owns browser registration with an Effect scope; closing
it unregisters tools and interrupts calls. `src/agents/connection.ts` uses typed
Foldkit ports, `Effect.callback` and Effect timeouts—not a Promise queue.
Promises exist only at library/browser boundaries. There is no outbound HTTP
in this integration; the MCP transport uses Effect's HTTP stack.

`src/agents/mcp.ts` also exports `makeMcpHandler(handlers, allowedOrigins)`, an
embeddable MCP Streamable HTTP `Request → Response` handler for `/mcp`, using
protocol version `2025-06-18`. Construct handlers with `makeToolHandlers(getStore,
connection)` and an open-app connection from `connectAgentApplication`. Dispose
the HTTP handler when its host closes. **This does not start a server or make
`/mcp` available on GitHub Pages.** External MCP clients need a host/bridge to
the browser session; OPFS cannot be read by a separate Node server. The host must
provide authentication if exposed outside its trusted process; an origin
allowlist is not authentication.

Agent tests cover MCP initialization/list/call, WebMCP schemas and cleanup, and
the actual UI/SQLite CRUD path with LiveStore's in-memory adapter. The latter
substitutes the experimental browser registry and human confirmation response;
it does not prove native-agent compatibility or OPFS/reload persistence.
