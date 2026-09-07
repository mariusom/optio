# optio

A fully offline **time & motion study** recorder — a standalone local-first
web app. No server, no sync, no account: every observation is written to a
local SQLite database persisted in **OPFS**, so it survives reloads,
background kills and airplane mode.

Installable as a home-screen app; hardening for standalone-PWA constraints
(viewport/safe-area/UI chrome) is a first-class concern (see below).

## What it does

- **Templates** — define the fields captured in every session: single choice
  (radio), multiple choice (checkbox with exclusive "clear others" options),
  text input, text area, toggle. Fields can be required, defaulted, reordered
  and renamed (duplicate / set-default / delete included).
- **Sessions** — pick a template, name the session (or accept a random
  two-word name), and record observations. Each task is one filled form; the
  first value written stamps `startDate` (SQL `COALESCE(startDate, now)`), and
  task/session durations are derived from it. Sessions can be resumed after a
  force-quit or a reload — the live session row _is_ the resume state.
- **Phone + tablet/desktop** — bottom navigation and a single-column task canvas
  on `<768px`; a compact workspace rail on tablets, and a labeled sidebar at
  `≥1200px`. Recording uses a split cockpit (`w-64 lg:w-80` task sidebar + form pane)
  at `≥768px`. Bottom tab
  bar is hidden during a live session, where a fixed timer + Record/End footer
  takes over.
- **History** — archived sessions with full task/section detail, editable
  session names, delete confirmation, and **CSV export** per session in both
  export formats (live per-option expanded columns, archive alphabetical
  union), downloaded as `optio_<name>_<yyyy-MM-dd_HH-mm-ss>.csv`.
- **Fully offline** — the whole app is a service-worker-precached PWA; there
  is no network dependency at runtime.

## Stack

| Layer              | Tool                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| UI framework       | [FoldKit](https://foldkit.dev) 0.157 — Elm architecture on Effect (Model / Message / update / view)                                           |
| Styling            | Tailwind CSS 4 + [Foldcn](https://foldcn.elianiva.com) / `@foldkit/ui`; daisyUI 5 retained for legacy components, sharing Foldcn theme tokens |
| Local-first data   | [LiveStore](https://livestore.dev) `0.5.0-dev.0` — reactive SQLite (WASM) in a worker, OPFS-persisted, store id `optio-v1`                    |
| Session logic      | `@typeonce/effect-machine` 0.31 — schema-first statechart (Idle → Live { Collecting \| ConfirmingEnd }), planned synchronously                |
| Runtime validation | Effect `4.0.0-rc.112` Schema (`decodeUnknownEffect` before every commit)                                                                      |
| Toolchain          | [Vite+](https://vite.plus) (`vp`) — dev server, Rolldown build, oxlint, oxfmt, type check, Vitest in one binary                               |
| PWA                | `vite-plugin-pwa` (`generateSW`, autoUpdate) + Workbox (confirmed-refresh update toast)                                                       |
| Package manager    | pnpm ≥ 11.25 (workspace `minimumReleaseAge: 1440` supply-chain guard)                                                                         |
| Hosting            | GitHub Pages (static SPA + service worker, served under `/optio/`)                                                                            |

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
```

## Foldcn components

`components.json` registers `@foldcn` and maps the `@/components`,
`@/components/ui`, `@/lib`, and `@/hooks` aliases. TypeScript and Vite both
resolve `@/` to `src/`. This is a Foldkit project, not React; always use
the **namespaced** registry items:

```sh
npx shadcn@latest add @foldcn/button @foldcn/dialog
```

Button, Dialog, and Native Select are installed as editable TypeScript source
in `src/components/ui`. The session launcher uses Button and Native Select;
Dialog is available for subsequent modal migration. No React/Radix components
are used. Stateful components such as Dialog must be wired as Foldkit submodels,
not treated as CSS-only wrappers; see the [Foldcn docs](https://foldcn.elianiva.com/docs).

`src/index.css` must retain `@import "tailwindcss";`. Foldcn's `:root`/`.dark`
tokens are the shared theme, and dark mode follows the system preference.
daisyUI remains for existing screens with its themes disabled and compatibility
aliases pointing to the same colors. Its control-local `--border` width is
isolated from Foldcn's `--border` color token.

The base registry currently requests Effect `4.0.0-rc.109`; this app keeps
`4.0.0-rc.112` to match its existing stack. Check dependency changes after any
registry update. Run `pnpm check`, `pnpm exec tsc --noEmit`, `pnpm test`, and
`pnpm build` after adding or updating components.

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
