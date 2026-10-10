# Architecture

Optio is a static web app with no backend or sync. Its views are TypeScript
functions using [FoldKit](https://foldkit.dev), not React. FoldKit's
model/message/update loop plans commands; commands perform effects, and
subscriptions bring store changes back into the model.

## Where behavior lives

- [entry.ts](../src/entry.ts) registers the service worker before anything
  else (so offline support installs even if the app fails to boot), then
  starts the browser runtime and optional agent registration. Saved preferences, the boot time and a random ID seed reach
  `init` as schema-checked FoldKit Flags (`Flags` and `initWithFlags` in
  [main.ts](../src/main.ts)). Browser events reach the app through
  subscriptions, never ad-hoc listeners: the service worker's "update ready"
  (handed over by `web/updateSignal.ts` even if it fired before the app
  subscribed; [web/appUpdate.ts](../src/web/appUpdate.ts) applies it only
  when tapped), the
  system color scheme that the "auto" theme follows (update issues
  `ApplyColorScheme`), visibility and page-leaving events.
- [application.ts](../src/application.ts) wires the runtime;
  [main.ts](../src/main.ts) initializes and exports the application modules.
- [app/model.ts](../src/app/model.ts) defines the root model and initial state.
  [app/update.ts](../src/app/update.ts) exhaustively dispatches messages to
  feature-named `*Update.ts` handlers and invalidates stale agent approvals.
  These handlers coordinate root state; feature commands perform storage writes.
- [app/subscriptions.ts](../src/app/subscriptions.ts) selects reactive streams;
  feature-named `*Streams.ts` files translate store rows into messages.
  `managedStream.ts` owns store subscriptions, their cleanup and recovery
  after a failed open (the stream reports the store unavailable, then
  resubscribes once it opens), and ends a stream whose subscription failed;
  subscriptions log such failures, and detail and list pages show them
  instead of loading forever (a failed list becomes `AsyncData` `Failure`;
  "Try again" bumps `listReadAttempt`, which restarts the list subscriptions). `domStreams.ts` owns focus and scroll effects, waiting for
  FoldKit's `Render.afterCommit`/`afterPaint`. Keep subscriptions wired:
  without them the app renders but stops receiving data. The live-timer ticker
  pauses while the tab is hidden.
- Store-backed lists in the Model (`templates`, `history`, `activeSession`)
  are FoldKit `AsyncData`: `Loading` until their stream first emits. Pages
  render only once their data is read (`whenLoaded` in `app/view.ts`), so a
  reload never flashes an empty state; slow reads fade in a skeleton of the page.
  Handlers and agent checks read loaded rows through `templatesOf`,
  `historyOf` and `activeSessionOf`. The templates subscription starts only after
  the startup sample-template check (`templatesSeedChecked`), so a first run
  never shows "No templates yet" before the samples are written.
- [app/view.ts](../src/app/view.ts) composes navigation and feature pages.
  A sheet is open exactly while its page renders it: page-model state (such as
  `pendingHistoryDelete`) is the only open/closed state, so agent actions and
  route changes open and close sheets with no extra bookkeeping.
  [web/features](../src/web/features) contains templates, session recording,
  history and settings: views, commands, pure feature helpers and their tests.
  Large views delegate to named sections such as `questionControls.ts` and
  `questionEditor.ts`, rather than numbered fragments.
- [web](../src/web) also owns shared browser preferences, routes, focus and
  presentation helpers. [messages.ts](../src/messages.ts) defines app messages.
  [session/runner.ts](../src/web/features/session/runner.ts) owns shared runner
  schemas, types, completion rules and focus traversal.
- [machine/session](../src/machine/session) plans session transitions and commands
  with a pure reducer; `runner.showEndConfirm` is the only record of the
  end-confirmation phase. Updates to owner data must preserve that phase.
- [livestore/schema.ts](../src/livestore/schema.ts) defines data, events and
  materializers; [livestore/queries.ts](../src/livestore/queries.ts) defines the
  reactive reads; [livestore/client.ts](../src/livestore/client.ts) opens the store.
  Commands and streams reach all three through `withStore`/`openStoreAccess` in
  [livestore/access.ts](../src/livestore/access.ts), which loads them lazily so
  LiveStore stays out of the startup bundle. Import only types from `schema.ts`
  and `queries.ts` elsewhere, apart from the lazily loaded agent tools.
- [agents](../src/agents) exposes app operations through the same update loop;
  read [agent access](agent-access.md) before changing that boundary.

Start a change in the feature directory. Follow its message into the matching
`app/*Update.ts` file for state coordination, or its command into `livestore`
for persistence. Use type-only imports when handlers or helpers need the
`Model` type; do not introduce a runtime import cycle through `main.ts`.

## Storage and timing constraints

[LiveStore](https://livestore.dev) runs SQLite in a worker and persists it in
[OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).
The store ID is `optio-v3`; older pre-release IDs are intentionally ignored, not
migrated or deleted. Export any wanted pre-release recordings before updating.
The reset removes events that omitted creation timestamps; those timestamps
cannot be recovered accurately from their event payloads alone.
Reuse the memoized `getStore()` promise: opening competing instances for the same
ID can leave them waiting on the store lock. A failed open is not memoized, so the
store-unavailable notice's retry (or any later command) opens it again and
waiting subscriptions resume. There is deliberately no open timeout: an abandoned
open would keep the lock. Without OPFS (some private windows) LiveStore keeps data
in memory; the app then warns wherever sessions are started or recorded.

Give each stream one query (`computed` over narrow `queryDb` reads, or SQL
joins and counts) so a commit that touches several tables emits one consistent
result. Read only the rows a screen shows; never subscribe to a whole table.

Materializers must be deterministic: capture wall-clock times (Effect's Clock)
and random IDs in commands and include them in events. Update never reads a
clock or random source either: IDs it needs at once (a new template, a question
draft, a session or template a command will create) come from `takeId`, which
combines the per-boot random `idSeed` with a counter in the Model. Tabs commit concurrently,
so materializers also guard their own invariants: one live session, tasks only in
a live session, first finish time wins, one default template and no duplicate
samples. Archived answers keep their question `position`. Archive IDs derive from session ID, task
number and section position (not section name). LiveStore
[rematerializes state on schema changes](https://dev.docs.livestore.dev/building-with-livestore/state/sqlite-schema)
and recommends [side-effect-free materializers](https://dev.docs.livestore.dev/building-with-livestore/state/materializers).

The live session row is the resume state. A field's first write stamps `startDate`
with SQL `COALESCE`; defaults do not start its timer, and edit-cancel rollback
restores values without changing that timestamp. Durations derive from these
timestamps. Preserve the same rules for UI and agent actions.

Typed answers are not written per keystroke. The session reducer shows each
keystroke at once and keeps unwritten values in `runner.fieldWrites`; the
`fieldWriteFlush` subscription writes them in one `UpdateFieldValues` batch after
500 ms without typing, and at once when a reload or navigation starts
(`beforeunload`), the page is hidden, or the runner is left. A blur, and every event that reads or replaces persisted answers (record,
task selection, edit save or cancel, counter taps, ending), writes them first.
A field's first answer and discrete choices are written immediately, so
`startDate` is the first keystroke's time, never the flush time. Runner write
commands take one lock in dispatch order, so a batch commits before the command
that follows it. Written values stay in the overlay until the store echoes
them, so an emission from an earlier write cannot revert a field. Page-leaving
flushes are best effort: browsers do not wait for asynchronous worker writes
before discarding a page. An immediate reload, crash or killed tab can lose
pending answers, including the last 500 ms of typing and writes still reaching
the worker. Assistant answers are written without the typing delay.
"Repeat last answers" is planned by the session reducer: it copies the previous
recorded task's answers into questions the open task has never answered (no
`startDate`), as one `UpdateFieldValues` batch through the same lock, so each
copy is that field's first write. A recorded task's vibration is a command
(`VibrateRecorded`), feature-detected and skipped silently where unsupported.

Wall-clock time reaches the UI through the Model. The runtime boot and the
ticker subscription read Effect's Clock; `Tick` stamps `model.now` and
`runner.now`, and the session planner receives that time as part of its input.
`model.now` is the latest sample, refreshed while a screen with a live timer is
active, so live timing renders from the Model instead of the clock. History
labels days ("Today") from `model.now`, which the ticker refreshes on entry and
each minute while History is open.

Completed-task edit rollback belongs to SQLite, not the UI model.
`TaskEditStarted` stores the original field values in `sessionTasks.editBackup`
in the same transaction as its edit flag. Reselecting that task retains the
snapshot; switching tasks or saving clears it. `TaskEditCancelled` restores the
snapshot and clears edit mode atomically, including after reload. It restores
values only, not first-write timestamps. A failed save retains the snapshot.

Validate event payloads with Effect Schema before commits. Template changes stay
in editor drafts until saved. Completed live tasks can be edited; archived
observation values are immutable. Archived CSV exports preserve duplicate
question names in separate columns. UI exports protect formula-like cells
without modifying stored observations; the raw programmatic format stays exact.

Optio adds no runtime network dependency for studies. Browser storage can still
be cleared or evicted; persistence is not a backup guarantee. After a session starts
on disk, `RequestPersistentStorage` asks the browser to exempt the site from
eviction under storage pressure (`navigator.storage.persist()`); the answer is
informational, and users can still clear site data. Service-worker
updates must wait for the user's refresh action rather than interrupt recording.
