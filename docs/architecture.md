# Architecture

Optio is a static web app with no backend or sync. Its views are TypeScript
functions using [Effect UI](https://ui.effect.website) (`@effect/ui`), not
React. The whole app is one root component, `App` in
[application.ts](../src/application.ts): its model/message/update loop plans
commands; commands perform effects, and subscriptions bring store changes back
into the model.

## Where behavior lives

- [entry.ts](../src/entry.ts) registers the service worker before anything
  else (so offline support installs even if the app fails to boot), then
  mounts `App` with `BrowserHost.mount` and starts optional agent registration. Saved preferences, the boot time and a random ID seed reach
  `init` as the root component's schema-checked props (`Flags` and `initWithFlags` in
  [main.ts](../src/main.ts)); the route comes from the URL fragment
  (`parseRoute` in [web/routes.ts](../src/web/routes.ts)), and the `route` and
  `links` subscriptions turn `hashchange` events and clicks on `#/` links into
  `GotRoute` and `ClickedLink`, so internal links pass the navigation guard. Browser events reach the app through
  subscriptions, never ad-hoc listeners: the service worker's "update ready"
  (handed over by `web/updateSignal.ts` even if it fired before the app
  subscribed; [web/appUpdate.ts](../src/web/appUpdate.ts) applies it only
  when tapped), the
  system color scheme that the "auto" theme follows (update issues
  `ApplyColorScheme`), visibility and page-leaving events.
- [application.ts](../src/application.ts) wraps the app's pure `init`,
  `update`, `subscriptions` and `view` in the root component: each root
  handler returns `{ model, commands }` (`UpdateResult` in
  [messages.ts](../src/messages.ts)), which becomes
  `$.set(model).run(...commands)`. [main.ts](../src/main.ts) initializes and
  exports the application modules.
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
  "Try again" bumps `listReadAttempt`, which restarts the list subscriptions:
  a subscription restarts when its deps change). `domStreams.ts` owns focus and scroll effects, waiting for
  the next committed render (`afterCommit`/`afterPaint` in
  [lib/domEvents.ts](../src/lib/domEvents.ts)). Keep subscriptions wired:
  without them the app renders but stops receiving data. The live-timer ticker
  pauses while the tab is hidden.
- Store-backed lists in the Model (`templates`, `history`, `activeSession`)
  are `AsyncData` ([lib/asyncData.ts](../src/lib/asyncData.ts)): `Loading` until their stream first emits. Pages
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
- [store/schema.ts](../src/store/schema.ts) defines the events,
  [store/materialize.ts](../src/store/materialize.ts) applies them to the tables
  in [store/tables.ts](../src/store/tables.ts),
  [store/queries.ts](../src/store/queries.ts) defines the reads and
  [store/openStore.ts](../src/store/openStore.ts) opens the store.
  Commands and streams reach them through `withStore`/`openStoreAccess` in
  [store/access.ts](../src/store/access.ts), which loads them lazily so
  the EventLog runtime stays out of the startup bundle. Import only types from `schema.ts`
  and `queries.ts` elsewhere, apart from the lazily loaded agent tools.
- [agents](../src/agents) exposes app operations through the same update loop;
  read [agent access](agent-access.md) before changing that boundary.

Start a change in the feature directory. Follow its message into the matching
`app/*Update.ts` file for state coordination, or its command into `store`
for persistence. Use type-only imports when handlers or helpers need the
`Model` type; do not introduce a runtime import cycle through `main.ts`.

## Storage and timing constraints

Every change is an event in an Effect
[EventLog](https://effect.website/docs/v4/api/effect/eventlog/EventLog) journal,
kept in the IndexedDB database `optio` (`EventJournal.layerIndexedDb`). The
tables are plain in-memory maps: opening the store replays the journal into
them, and each write runs the events' handlers before the journal commits it.
Nothing syncs; the log has a fixed local identity. Data from the former store
is not migrated.

Only one tab opens the store. It takes the `optio-store` Web Lock until it
closes, because other tabs would not see its writes; a second tab gets the
store-unavailable notice. Reuse the memoized `getStore()` promise. A failed open
is not memoized, so the notice's retry (or any later command) opens it again
and waiting subscriptions resume. Where the browser refuses IndexedDB (some
private windows) the store keeps data in memory; the app then warns wherever
sessions are started or recorded. `globalThis.__debugOptioStore` exposes the
open store for debugging and the end-to-end journeys.

`store.subscribe` re-runs a query after every write and emits only when its
result changed. Give each stream one query so a commit that touches several
tables emits one consistent result. Read only the rows a screen shows.

Event handlers must be deterministic: capture wall-clock times (Effect's Clock)
and random IDs in commands and include them in events. Update never reads a
clock or random source either: IDs it needs at once (a new template, a question
draft, a session or template a command will create) come from `takeId`, which
combines the per-boot random `idSeed` with a counter in the Model. Handlers
also guard their own invariants, so a replayed or repeated event is harmless: one live session, tasks only in
a live session, first finish time wins, one default template and no duplicate
samples. Archived answers keep their question `position`. Archive IDs derive from session ID, task
number and section position (not section name). Because tables are rebuilt
from the journal on every open, a table change needs no migration; event names
and payloads do, since they are the stored data.

The live session row is the resume state. A field's first write stamps `startDate`
and later writes keep it; defaults do not start its timer, and edit-cancel rollback
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
flushes are best effort: browsers do not wait for asynchronous IndexedDB writes
before discarding a page. An immediate reload, crash or killed tab can lose
pending answers, including the last 500 ms of typing and writes still being
saved. Assistant answers are written without the typing delay.
A recorded task's vibration is a command
(`VibrateRecorded`), feature-detected and skipped silently where unsupported.

Wall-clock time reaches the UI through the Model. The runtime boot and the
ticker subscription read Effect's Clock; `Tick` stamps `model.now` and
`runner.now`, and the session planner receives that time as part of its input.
`model.now` is the latest sample, refreshed while a screen with a live timer is
active, so live timing renders from the Model instead of the clock. History
labels days ("Today") from `model.now`, which the ticker refreshes on entry and
each minute while History is open.

Completed-task edit rollback belongs to the store, not the UI model.
`TaskEditStarted` stores the original field values in `sessionTasks.editBackup`
in the same event as its edit flag. Selecting a finished task also marks it as
being edited in the runner at once, so answers typed before the store confirms
are kept. Reselecting that task retains the
snapshot; switching tasks or saving clears it. `TaskEditCancelled` restores the
snapshot and clears edit mode atomically, including after reload. It restores
values only, not first-write timestamps. A failed save retains the snapshot.

Validate event payloads with Effect Schema before commits. Template changes stay
in editor drafts until saved. Completed live tasks can be edited; archived
observation values are immutable. Archived CSV exports preserve duplicate
question names in separate columns. UI exports protect formula-like cells
without modifying stored observations; the raw programmatic format stays exact.

Optio adds no runtime network dependency for studies. Browser storage can still
be cleared or evicted; persistence is not a backup guarantee. Opening the store
on disk asks the browser to exempt the site from eviction under storage pressure
(`navigator.storage.persist()` in `store/openStore.ts`); the answer is not
checked, and users can still clear site data. Settings downloads a JSON
backup of every template and finished session (`web/backup.ts`); restoring
commits one `v3.BackupRestored` event that adds only what is missing. The
command plans the restore first: templates whose ID exists, or with the same
name and questions (each browser seeds its own samples), are kept, and their
sessions are repointed to the existing template. The handler still
skips any existing ID, so replays and repeated restores stay harmless.
Before committing, `backupProblem` refuses files with values Optio never
writes (fractional or negative question order, task numbers below 1, unnamed
templates or questions, impossible times), which would otherwise break the
store. Restore reports success once the journal has saved the event.

If the browser's storage stops responding, new work shows on screen but may
never reach disk. `app/saveStallStreams.ts` warns when a write stays unsaved
for 20 s (not during a backup or restore) and
offers a backup. While saving is stalled the backup also includes the open
session as if ended now, and restoring a session whose ID is still live here
adds it as a separate "-restored" copy. If reloading does not clear the
warning, Settings' "Reset storage in this browser" sets a one-time flag
(`store/resetFlag.ts`) so the next open deletes the journal, after which the
backup can be restored. Service-worker
updates must wait for the user's refresh action rather than interrupt recording.
