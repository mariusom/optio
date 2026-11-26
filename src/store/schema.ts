import { Array, Record, Schema } from "effect";
import { EventGroup, EventLog } from "effect/eventlog";

import { FieldDef } from "../domain/fields";
import { ArchiveRecord } from "../domain/archive";

// The store's events. Each one is appended to the EventLog journal and applied
// to the in-memory tables by `materialize.ts`; opening the store replays the
// journal. Event names are part of the stored data: never rename one.

const definition = <const Tag extends string, Payload extends Schema.Top>(
  tag: Tag,
  payload: Payload,
  primaryKey: (payload: Payload["Type"]) => string,
) => ({ tag, payload, primaryKey });

const byId = (payload: { readonly id: string }) => payload.id;
const bySession = (payload: { readonly sessionId: string }) => payload.sessionId;
const single = () => "all";

const SeededTemplate = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  fields: Schema.Array(FieldDef),
});

const RestoredSession = Schema.Struct({
  id: Schema.String,
  templateId: Schema.NullOr(Schema.String),
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.DateFromMillis,
  endedAt: Schema.DateFromMillis,
  records: Schema.Array(ArchiveRecord),
});

const definitions = {
  templateCreated: definition(
    "v3.TemplateCreated",
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      isDefault: Schema.Boolean,
      now: Schema.DateFromMillis,
    }),
    byId,
  ),
  /** Full editor save: template metadata + wholesale field replacement, atomic. */
  templateUpdated: definition(
    "v3.TemplateUpdated",
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      isDefault: Schema.Boolean,
      fields: Schema.Array(FieldDef),
      now: Schema.DateFromMillis,
    }),
    byId,
  ),
  /** Wholesale field replacement (used by duplicate). */
  fieldsReplaced: definition(
    "v2.FieldsReplaced",
    Schema.Struct({ templateId: Schema.String, fields: Schema.Array(FieldDef) }),
    (payload) => payload.templateId,
  ),
  templateDeleted: definition("v2.TemplateDeleted", Schema.Struct({ id: Schema.String }), byId),
  /** Clears other defaults, then sets the given template as the sole default. */
  templateDefaultSet: definition(
    "v2.TemplateDefaultSet",
    Schema.Struct({ id: Schema.String }),
    byId,
  ),
  /** Atomic first-boot seeding of sample content (never leaves user template-less). */
  templatesSeeded: definition(
    "v3.TemplatesSeeded",
    Schema.Struct({ now: Schema.DateFromMillis, templates: Schema.Array(SeededTemplate) }),
    single,
  ),

  // ── Sessions ────────────────────────────────────────────────────────────
  sessionStarted: definition(
    "v3.SessionStarted",
    Schema.Struct({
      id: Schema.String,
      templateId: Schema.NullOr(Schema.String),
      templateName: Schema.String,
      sessionName: Schema.String,
      now: Schema.DateFromMillis,
    }),
    byId,
  ),
  sessionRenamed: definition(
    "v2.SessionRenamed",
    Schema.Struct({ id: Schema.String, sessionName: Schema.String }),
    byId,
  ),
  /**
   * Ends a session: stamps endedAt and archives finished tasks into history
   * records. When zero finished tasks exist it changes nothing, so the caller
   * can delete the whole session instead.
   */
  sessionEnded: definition(
    "v2.SessionEnded",
    Schema.Struct({
      id: Schema.String,
      endedAt: Schema.DateFromMillis,
      records: Schema.Array(ArchiveRecord),
    }),
    byId,
  ),
  /** Adds a backup's templates and finished sessions; anything already present is kept. */
  backupRestored: definition(
    "v3.BackupRestored",
    Schema.Struct({
      now: Schema.DateFromMillis,
      templates: Schema.Array(
        Schema.Struct({ id: Schema.String, name: Schema.String, fields: Schema.Array(FieldDef) }),
      ),
      sessions: Schema.Array(RestoredSession),
    }),
    single,
  ),
  /** Deletes a session's live graph (tasks + their fields). */
  sessionLiveGraphCleared: definition(
    "v2.SessionLiveGraphCleared",
    Schema.Struct({ sessionId: Schema.String }),
    bySession,
  ),
  /** Deletes an archived session with all its records (cascade semantics). */
  sessionDeleted: definition("v2.SessionDeleted", Schema.Struct({ id: Schema.String }), byId),

  // ── Live tasks ──────────────────────────────────────────────────────────
  taskSpawned: definition(
    "v2.TaskSpawned",
    Schema.Struct({
      sessionId: Schema.String,
      id: Schema.String,
      orderIndex: Schema.Number,
      fields: Schema.Array(FieldDef),
    }),
    byId,
  ),
  taskFinished: definition(
    "v2.TaskFinished",
    Schema.Struct({ id: Schema.String, endedAt: Schema.DateFromMillis }),
    byId,
  ),
  /** Snapshots original values atomically with entering edit mode. */
  taskEditStarted: definition(
    "v3.TaskEditStarted",
    Schema.Struct({ sessionId: Schema.String, id: Schema.String }),
    byId,
  ),
  taskEditFinished: definition("v2.TaskEditFinished", Schema.Struct({ id: Schema.String }), byId),
  taskEditCancelled: definition("v3.TaskEditCancelled", Schema.Struct({ id: Schema.String }), byId),
  /** Writes a live field value; `startDate` is stamped on the first write only. */
  taskFieldValueChanged: definition(
    "v2.TaskFieldValueChanged",
    Schema.Struct({ id: Schema.String, value: Schema.String, now: Schema.DateFromMillis }),
    byId,
  ),
};

type Definitions = typeof definitions;

/** One event to commit: its stored name and decoded payload. */
export type StoreEvent = {
  readonly [K in keyof Definitions]: {
    readonly name: Definitions[K]["tag"];
    readonly args: Definitions[K]["payload"]["Type"];
  };
}[keyof Definitions];

export type EventName = StoreEvent["name"];
export type PayloadOf<N extends EventName> = Extract<StoreEvent, { readonly name: N }>["args"];

/** Event constructors, such as `events.templateDeleted({ id })`. */
export const events = Record.map(definitions, ({ tag }) => (args: unknown) => ({
  name: tag,
  args,
})) as unknown as {
  readonly [K in keyof Definitions]: (
    args: Definitions[K]["payload"]["Type"],
  ) => Extract<StoreEvent, { readonly name: Definitions[K]["tag"] }>;
};

const d = definitions;

export const StoreEvents = EventGroup.empty
  .add(d.templateCreated)
  .add(d.templateUpdated)
  .add(d.fieldsReplaced)
  .add(d.templateDeleted)
  .add(d.templateDefaultSet)
  .add(d.templatesSeeded)
  .add(d.sessionStarted)
  .add(d.sessionRenamed)
  .add(d.sessionEnded)
  .add(d.backupRestored)
  .add(d.sessionLiveGraphCleared)
  .add(d.sessionDeleted)
  .add(d.taskSpawned)
  .add(d.taskFinished)
  .add(d.taskEditStarted)
  .add(d.taskEditFinished)
  .add(d.taskEditCancelled)
  .add(d.taskFieldValueChanged);

export const schema = EventLog.schema(StoreEvents);

export const eventNames: ReadonlyArray<EventName> = Array.map(
  Record.values(definitions),
  ({ tag }) => tag,
);
