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
- [machine/session](../src/machine/session) plans session transitions and commands.
  Updates to owner data must preserve the collecting or end-confirmation phase.
- [livestore/schema.ts](../src/livestore/schema.ts) defines data, events and
  materializers; [livestore/client.ts](../src/livestore/client.ts) opens the store.
- [agents](../src/agents) exposes app operations through the same update loop;
  read [agent access](agent-access.md) before changing that boundary.

## Storage and timing constraints

[LiveStore](https://livestore.dev) runs SQLite in a worker and persists it in
[OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).
The store ID is `optio-v1`; older IDs are intentionally ignored, not migrated.
Reuse the memoized `getStore()` promise: opening competing instances for the same
ID can leave them waiting on the store lock.

The live session row is the resume state. A field's first write stamps `startDate`
with SQL `COALESCE`; defaults do not start its timer, and edit-cancel rollback
restores values without changing that timestamp. Durations derive from these
timestamps. Preserve the same rules for UI and agent actions.

Validate event payloads with Effect Schema before commits. Template changes stay
in editor drafts until saved. Completed live tasks can be edited; archived
observation values are immutable. Live and archived CSV exports use different
column layouts, so preserve both when changing export behavior.

Optio adds no runtime network dependency for studies. Browser storage can still
be cleared or evicted; persistence is not a backup guarantee. Service-worker
updates must wait for the user's refresh action rather than interrupt recording.
