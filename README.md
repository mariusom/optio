# optio

This repository is an experiment to check the capabilities of **ox-alpha**, an LLM developed by an undisclosed organization, running as a coding agent inside the OpenCode harness.

This is **not** a production project — it exists purely for experimentation and capability testing. Contents change frequently as different capabilities are explored.

## The app

An offline-capable "Hello World": type a greeting, it's validated at runtime and persisted into a local SQLite database that survives reloads — no server involved.

## Stack

| Layer              | Tool                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| UI framework       | [FoldKit](https://foldkit.dev) 0.151 — Elm architecture on Effect (Model / Message / update / view)             |
| Styling            | Tailwind CSS 4 + daisyUI 5                                                                                      |
| Local-first data   | [LiveStore](https://livestore.dev) `0.5.0-dev.0` — reactive SQLite (WASM) in a web worker, OPFS-persisted       |
| Runtime validation | Effect `4.0.0-rc.111` Schema (`decodeUnknownEffect` before every commit)                                        |
| Toolchain          | [Vite+](https://vite.plus) (`vp`) — dev server, Rolldown build, oxlint, oxfmt, type check, Vitest in one binary |
| Package manager    | pnpm ≥ 11.22                                                                                                    |
| Hosting            | GitHub Pages (static SPA + PWA service worker)                                                                  |

### Supply-chain guard

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` — dependency versions published less than 24h ago are refused. (`foldkit` is currently excluded from this rule at the maintainer's request.)

## Commands

```sh
pnpm install         # install dependencies
pnpm dev             # dev server (vp dev) → http://localhost:60001
pnpm build           # production build (vp build) → dist/
pnpm check           # oxfmt + oxlint + type checks in one shot
pnpm test            # vitest via vp test
pnpm preview         # preview the production build
```

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with Vite+ and publishes `dist/` to GitHub Pages. The app is served under `/optio/` (`base` in `vite.config.ts`) and works offline after the first visit thanks to the generated service worker.
