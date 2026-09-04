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
- **Phone + tablet/desktop** — single-column task canvas on `<768px`; a split
  cockpit (`w-80 lg:w-96` task sidebar + form pane) at `≥768px`. Bottom tab
  bar is hidden during a live session, where a fixed timer + Record/End footer
  takes over.
- **History** — archived sessions with full task/section detail, editable
  session names, delete confirmation, and **CSV export** per session in both
  export formats (live per-option expanded columns, archive alphabetical
  union), downloaded as `optio_<name>_<yyyy-MM-dd_HH-mm-ss>.csv`.
- **Fully offline** — the whole app is a service-worker-precached PWA; there
  is no network dependency at runtime.

## Stack

| Layer              | Tool                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| UI framework       | [FoldKit](https://foldkit.dev) 0.157 — Elm architecture on Effect (Model / Message / update / view)                            |
| Styling            | Tailwind CSS 4 + daisyUI 5 (`optio-light` / `optio-dark` themes, grouped surfaces)                                             |
| Local-first data   | [LiveStore](https://livestore.dev) `0.5.0-dev.0` — reactive SQLite (WASM) in a worker, OPFS-persisted, store id `optio-v1`     |
| Session logic      | `@typeonce/effect-machine` 0.31 — schema-first statechart (Idle → Live { Collecting \| ConfirmingEnd }), planned synchronously |
| Runtime validation | Effect `4.0.0-rc.112` Schema (`decodeUnknownEffect` before every commit)                                                       |
| Toolchain          | [Vite+](https://vite.plus) (`vp`) — dev server, Rolldown build, oxlint, oxfmt, type check, Vitest in one binary                |
| PWA                | `vite-plugin-pwa` (`generateSW`, autoUpdate) + Workbox (confirmed-refresh update toast)                                        |
| Package manager    | pnpm ≥ 11.25 (workspace `minimumReleaseAge: 1440` supply-chain guard)                                                          |
| Hosting            | GitHub Pages (static SPA + service worker, served under `/optio/`)                                                             |

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

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with
Vite+ and publishes `dist/` to GitHub Pages. The app is served under `/optio/`
(`base` in `vite.config.ts`) and is fully usable offline after the first
visit thanks to the generated service worker.

## Local data

Everything lives in the browser: LiveStore → SQLite (WASM) → OPFS. The store
id is `optio-v1` — earlier store versions are deliberately incompatible and
ignored. There is intentionally no sync and no backend.
