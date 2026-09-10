# Architecture

Optio is a static web app with no backend or sync. Its views are TypeScript
functions using [FoldKit](https://foldkit.dev), not React. FoldKit's
model/message/update loop plans commands; commands perform effects, and
subscriptions bring store changes back into the model.

## Where behavior lives

- [entry.ts](../src/entry.ts) starts the browser runtime, preferences, sheet focus,
  service-worker update prompt and optional agent registration.
- [application.ts](../src/application.ts) wires the runtime;
  [main.ts](../src/main.ts) owns the root model, update, view and subscriptions.
  Keep subscriptions wired: without them the app renders but stops receiving data.
- [we/features](../src/we/features) contains templates, session recording,
  history and settings. [messages.ts](../src/messages.ts) defines app messages.
  [session/runner.ts](../src/we/features/session/runner.ts) owns shared runner
  schemas, types, completion rules and focus traversal.
- [machine/session](../src/machine/session) plans session transitions and commands.
  Updates to owner data must preserve the collecting or end-confirmation phase.
- [livestore/schema.ts](../src/livestore/schema.ts) defines data, events and
  materializers; [livestore/client.ts](../src/livestore/client.ts) opens the store.
- [agents](../src/agents) exposes app operations through the same update loop;
  read [agent access](agent-access.md) before changing that boundary.

## Storage and timing constraints

[LiveStore](https://livestore.dev) runs SQLite in a worker and persists it in
[OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).
The store ID is `optio-v3`; older pre-release IDs are intentionally ignored, not
migrated or deleted. Export any wanted pre-release recordings before updating.
The reset removes events that omitted creation timestamps; those timestamps
cannot be recovered accurately from their event payloads alone.
Reuse the memoized `getStore()` promise: opening competing instances for the same
ID can leave them waiting on the store lock.

Materializers must be deterministic: capture wall-clock times and random IDs in
commands and include them in events. Archive IDs derive from session ID, task
number and section position (not section name). LiveStore
[rematerializes state on schema changes](https://dev.docs.livestore.dev/building-with-livestore/state/sqlite-schema)
and recommends [side-effect-free materializers](https://dev.docs.livestore.dev/building-with-livestore/state/materializers).

The live session row is the resume state. A field's first write stamps `startDate`
with SQL `COALESCE`; defaults do not start its timer, and edit-cancel rollback
restores values without changing that timestamp. Durations derive from these
timestamps. Preserve the same rules for UI and agent actions.

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
be cleared or evicted; persistence is not a backup guarantee. Service-worker
updates must wait for the user's refresh action rather than interrupt recording.
