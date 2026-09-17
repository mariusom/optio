# Bundled development research

Status: 2026-09-17. This note records the upstream evidence and controlled
measurements behind Optio's development-server configuration at the original
baseline revision, before the separate dependency update to FoldKit 0.159.0,
its Vite plugin 0.21.0, and Vite+ 0.3.2. The version comparisons below are
historical experiments, not instructions to undo that update. Routine commands
remain in [development.md](development.md).

## Decision

Keep Vite's lazy bundled-dev mode for remote previews, with the narrow
`/@vite/lazy?` base-path rewrite in `vite.config.ts`. Keep ordinary unbundled
Vite available through `pnpm dev --mode test` when Foldkit model-preserving HMR
or ordinary plugin behavior matters. Do not disable lazy compilation, change
optimizer settings for bundled dev, update tooling solely for this issue, or
add a general HMR adapter.

This is deliberately a development-only choice. Before the dependency update,
a production build with the workaround was byte-for-byte identical across all
27 output files to a
build from [the baseline revision](https://github.com/mariusom/optio/commit/f777ece97e283e288c9638fe584312352bbadbfd)
using the same dependencies.

### Shipping revalidation after the dependency update

After rebasing onto the separate FoldKit 0.159.0/plugin 0.21.0/Vite+ 0.3.2
update, the real dev-store check passed and the retained configuration measured
3,717 ms to usable controls with 10 requests / 7 scripts at 250 ms latency.
A fresh source-edit probe still full-reloaded and cleared the unsaved session
name. The warning and workaround therefore remain applicable. The production
benchmark's 30-task recording/edit/reload journey, startup checks, and real
offline storage test also passed on the updated stack. These are compatibility
checks, not a controlled performance comparison with the original baseline.

## Versions and support status

The original measured baseline resolved Foldkit `0.158.2`,
`@foldkit/vite-plugin` `0.20.2`, Effect `4.0.0-rc.112`, and Vite+ `0.3.1`
(Vite `8.2.2`, Rolldown `1.2.7`). The Foldkit packages were published on
2026-09-07 from commit
[`fa58326`](https://github.com/foldkit/foldkit/commit/fa58326c9959d93d0edae71522711cb8c11546c1).

Vite announced bundled dev as **experimental** on 2026-06-23 and limits the
current scope to browser applications, basic plugins, and main features;
third-party plugins and minor features may not work
([Vite 8.1 announcement](https://vite.dev/blog/announcing-vite8-1)). The open
[design/roadmap discussion #22746](https://github.com/vitejs/vite/discussions/22746)
(created 2026-06-23, updated 2026-09-03) says:

- lazy compilation is the default; `lazy: false` is an opt-out intended for
  debugging and normally should not be needed;
- the dependency optimizer does not run in bundled-dev mode;
- plugin HMR hooks, incremental rebuild correctness, glob support, CSS HMR,
  and a plugin-author guide remain roadmap work.

The open [Phase 1 feedback discussion
#22747](https://github.com/vitejs/vite/discussions/22747) (created 2026-06-23,
updated 2026-07-30) contains real plugin/runtime failures and reports released
bundled-dev versions using full reloads rather than granular CSS updates. This
matches Optio's current-version behavior.

## Upstream bugs and local compatibility work

### Non-root lazy imports

[Vite issue #23216](https://github.com/vitejs/vite/issues/23216) is open
(created 2026-08-10, updated 2026-08-13): with bundled dev and a non-root
`base`, generated dynamic imports request root-relative `/@vite/lazy?...` and
receive a 404. [PR #23257](https://github.com/vitejs/vite/pull/23257) is still
an open draft, not a released fix. Vite `8.2.2` runs user
[`configureServer` hooks before its base middleware](https://github.com/vitejs/vite/blob/v8.2.2/packages/vite/src/node/server/index.ts#L960-L987),
while the lazy middleware only accepts
[`/@vite/lazy?`](https://github.com/vitejs/vite/blob/v8.2.2/packages/vite/src/node/server/middlewares/triggerLazyBundling.ts#L14-L24).
The local pre-base middleware therefore rewrites only that exact query prefix
to `/optio/@vite/lazy?...`; it does not proxy or rewrite other root paths.

The workaround is necessary and sufficient for Optio's current dynamic import:
the real dev-store journey loads `openStore`, starts the LiveStore worker and
SharedWorker, fetches SQLite WASM, writes data, and preserves it after reload.
Vite's documented worker constructor/query forms and static-option constraints
remain the supported API ([worker guide](https://vite.dev/guide/features.html#web-workers));
standard dynamic imports split normally, while variable imports have documented
path constraints ([dynamic import guide](https://vite.dev/guide/features.html#dynamic-import)).

### Plugin HMR

Foldkit `0.158.2` implements model preservation in a Vite
[`handleHotUpdate` hook](https://github.com/foldkit/foldkit/blob/fa58326c9959d93d0edae71522711cb8c11546c1/packages/vite-plugin-foldkit/src/index.ts#L736-L800).
That hook sends a full reload and coordinates model preservation. Bundled-dev's
plugin contract is not equivalent:

- [Vite issue #23125](https://github.com/vitejs/vite/issues/23125) is open. A
  maintainer states that `server` cannot be supplied and plugin changes are
  expected until guidance exists
  ([comment](https://github.com/vitejs/vite/issues/23125#issuecomment-5162509851)).
- [Vite issue #23314](https://github.com/vitejs/vite/issues/23314) remains open
  and was updated 2026-09-14; it records missing `this.environment` and stale
  output after hook failures.
- The broader adapter [PR #22956](https://github.com/vitejs/vite/pull/22956) is
  **open, draft, and unmerged** as of 2026-09-17. GitHub's API is authoritative
  here; a rendered page summary seen during research incorrectly called it
  merged.

Optio's source-edit probe confirms the consequence: ordinary unbundled Vite
reloaded while preserving an unsaved `HMR sentinel` input, but bundled Vite
8.2.2, bundled Vite with lazy compilation disabled, and Vite 8.3.0 all reloaded
and reset the input to empty. Source changes are visible, but this is not
Foldkit's state-preserving HMR behavior.

To repeat the input-preservation probe, open a fresh dev browser, type a unique
session name without submitting, and temporarily change the Start Session
button's label in `src/web/features/session/startView.ts`. Wait for the changed
label, check whether the session name survived, then restore the source file.
Repeat with ordinary and bundled dev, without manually reloading the browser.

`@tailwindcss/vite` `4.3.3` has a separate crash because its `hotUpdate` hook
expects Vite's `server` argument. [Issue
#20378](https://github.com/tailwindlabs/tailwindcss/issues/20378) was fixed by
[PR #20379](https://github.com/tailwindlabs/tailwindcss/pull/20379), merged on
2026-08-03. However, the latest stable package checked on 2026-09-17 was still
`4.3.3`, published before that merge on 2026-07-16. Keep the existing
bundled-dev-only hook deletion until a stable release containing the fix is
adopted and verified. A real class addition was detected, regenerated
`src/index.css`, and reached the browser through a full reload. A comment-only
edit or a new unimported file did not trigger output. This does not establish
that arbitrary new source directories or plugin watch patterns are handled.

## Controlled measurements

The harness opens a disposable browser context with HTTP cache disabled, adds
250 ms latency through Chrome DevTools Protocol, navigates to `/optio/`, and
stops when **Start Session** is usable. Each compared server used the same code,
browser, machine, and `scripts/measure-dev-load.mjs`. The normal command is:

```sh
amp orb service start optio-dev --command 'pnpm dev --host 0.0.0.0' --port 60001
node scripts/measure-dev-load.mjs http://localhost:60001/optio/
node scripts/test-dev-store.mjs http://localhost:60001/optio/
amp orb service stop optio-dev
```

For the fallback, the server command was `pnpm dev --host 0.0.0.0 --mode test`.
The lazy-off comparison used the documented temporary
`build.rolldownOptions.experimental.devMode.lazy = false`; the temporary config
was removed. Vite+ `0.3.2` was run from a temporary isolated installation and
was not saved to the manifest or lockfile.

| Configuration                                     |                 Ready times | Requests / scripts | Result                                                             |
| ------------------------------------------------- | --------------------------: | -----------------: | ------------------------------------------------------------------ |
| Current bundled Vite 8.2.2, fresh server each run |    4,849 / 4,872 / 4,875 ms |             10 / 6 | Best request reduction; lazy import, workers, and WASM passed      |
| Current bundled, warm same server                 | 4,152 then 3,603 / 3,593 ms |         9–10 / 6–7 | Compile cache helps but does not change the decision               |
| Unbundled, optimizer-cold                         |                   20,018 ms |          275 / 269 | Optimizer discovery/reload adds a first-run penalty                |
| Unbundled, optimizer-warm                         |          11,053 / 10,964 ms |          125 / 122 | Source-module waterfall remains                                    |
| Bundled with `lazy: false`                        |    4,338 / 4,354 / 4,847 ms |             11 / 7 | No material win; removes the lazy request but eagerly adds work    |
| Temporary Vite+ 0.3.2 / Vite 8.3.0                |    4,921 / 4,550 / 4,388 ms |             10 / 6 | Still requested root-relative `/@vite/lazy`; HMR still reset state |

The final retained configuration sanity run was 4,626 ms, 9 requests, and 6
scripts; the real store check passed. Local server TTFB was usually 1–3 ms, so
the 250 ms per-request remote latency—not local transform response—is the reason
request count dominates. The current bundled server's median startup readiness
was 1,941 ms versus 2,159 ms with lazy compilation disabled, so `lazy: false`
also did not improve server readiness.

## Rejected alternatives and supported paths

- **More `optimizeDeps` tuning:** not applicable to bundled dev because Vite
  explicitly bypasses the optimizer. Foldkit's scaffold does set
  [`entries: ['src/entry.ts']`](https://github.com/foldkit/foldkit/blob/fa58326c9959d93d0edae71522711cb8c11546c1/packages/create-foldkit-app/templates/base/vite.config.ts#L1-L11),
  but Optio's HTML already points to that entry and `entries` only replaces the
  optimizer's normal entry inference
  ([Vite optimizer docs](https://vite.dev/config/dep-optimization-options)).
  The warm unbundled result shows optimization working, but still has 122 script
  requests, including unbundled app source modules.
- **Disable lazy compilation:** documented as a debugging opt-out; it did not
  consistently improve page readiness, worsened server startup, added a
  request/script, and did not restore Foldkit HMR.
- **Update Vite+/Vite immediately:** Vite 8.3.0 (released 2026-09-10) retained
  both relevant behaviors in the controlled probe. The actual base-path and
  HMR fixes are still unmerged upstream, so an update would add migration risk
  without solving this workstream.
- **Split Foldkit routes or use subscriptions/lazy views:** Foldkit documents
  that routes do not automatically split; explicit dynamic imports split heavy
  dependencies, while `createLazy` is view memoization
  ([performance guide](https://foldkit.dev/faq/performance)). Subscriptions are
  scoped Effect Streams for ongoing effects, not module delivery
  ([architecture guide](https://foldkit.dev/core/architecture)). Optio already
  dynamically imports its storage and optional agent modules.
- **Change Effect import style/config:** Effect documents standard named or
  subpath namespace imports and says Rolldown supports the deep analysis needed
  to tree-shake named imports
  ([Effect import guide](https://effect.website/docs/getting-started/importing-effect)).
  It documents no separate Vite remote-dev bundling mode. This does not address
  source-module round trips.
- **General local HMR adapter:** rejected until Vite settles the plugin contract.
  It would duplicate an open upstream design, depend on unstable internals, and
  still need bespoke Foldkit and Tailwind semantics.

Remaining risks are explicit: bundled dev is experimental; source edits lose
unsaved in-memory Model state; unknown third-party plugin hooks may be
incompatible; newly introduced lazy imports, worker forms, globs, CSS behavior,
or non-root internal endpoints require regression checks. Re-run both dev
scripts and the unsaved-input probe when Vite, Rolldown, Foldkit, or Tailwind is
updated, and remove local workarounds only after the pinned release passes them.
