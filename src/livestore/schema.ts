import { Events, State, makeSchema } from "@livestore/livestore";
import { Schema } from "effect";

// ── Domain schemas ───────────────────────────────────────────────────────

/** The five optio field types (raw strings mirror the domain enum). */
export const FieldKind = Schema.Literals(["radio", "checkbox", "textInput", "textArea", "boolean"]);
export type FieldKind = typeof FieldKind.Type;

export const FieldDef = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: FieldKind,
  isRequired: Schema.Boolean,
  defaultValue: Schema.String,
  sortOrder: Schema.Number,
  options: Schema.Array(Schema.String),
  exclusiveOptions: Schema.Array(Schema.String),
});
export type FieldDef = typeof FieldDef.Type;

// ── Tables ────────────────────────────────────────────────────────────────

export const tables = {
  templates: State.SQLite.table({
    name: "templates",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      name: State.SQLite.text({ default: "" }),
      // 0/1 integers — converted at the edges, avoids schema surprises
      isDefault: State.SQLite.integer({ default: 0 }),
      createdAt: State.SQLite.integer({ nullable: false, schema: Schema.DateFromMillis }),
      updatedAt: State.SQLite.integer({ nullable: false, schema: Schema.DateFromMillis }),
    },
  }),
  templateFields: State.SQLite.table({
    name: "templateFields",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      templateId: State.SQLite.text({ default: "" }),
      name: State.SQLite.text({ default: "" }),
      kind: State.SQLite.text({ default: "textInput" }),
      isRequired: State.SQLite.integer({ default: 0 }),
      defaultValue: State.SQLite.text({ default: "" }),
      sortOrder: State.SQLite.integer({ default: 0 }),
      // JSON-encoded string arrays (mirrors the original codec semantics)
      optionsJson: State.SQLite.text({ default: "[]" }),
      exclusiveOptionsJson: State.SQLite.text({ default: "[]" }),
    },
    indexes: [{ name: "idx_templateFields_template", columns: ["templateId"] }],
  }),
  // Sessions (live + archived unified: endedAt IS NULL ⇒ live/open)
  sessions: State.SQLite.table({
    name: "sessions",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      templateId: State.SQLite.text({ nullable: true }),
      templateName: State.SQLite.text({ default: "" }),
      sessionName: State.SQLite.text({ default: "" }),
      startedAt: State.SQLite.integer({ nullable: false, schema: Schema.DateFromMillis }),
      endedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromMillis }),
    },
  }),
  sessionTasks: State.SQLite.table({
    name: "sessionTasks",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      sessionId: State.SQLite.text({ default: "" }),
      orderIndex: State.SQLite.integer({ default: 1 }),
      taskType: State.SQLite.text({ default: "single" }),
      endDate: State.SQLite.integer({ nullable: true, schema: Schema.DateFromMillis }),
      isBeingEdited: State.SQLite.integer({ default: 0 }),
    },
    indexes: [{ name: "idx_sessionTasks_session", columns: ["sessionId"] }],
  }),
  sessionTaskFields: State.SQLite.table({
    name: "sessionTaskFields",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      taskId: State.SQLite.text({ default: "" }),
      name: State.SQLite.text({ default: "" }),
      kind: State.SQLite.text({ default: "textInput" }),
      isRequired: State.SQLite.integer({ default: 0 }),
      defaultValue: State.SQLite.text({ default: "" }),
      sortOrder: State.SQLite.integer({ default: 0 }),
      optionsJson: State.SQLite.text({ default: "[]" }),
      exclusiveOptionsJson: State.SQLite.text({ default: "[]" }),
      value: State.SQLite.text({ default: "" }),
      startDate: State.SQLite.integer({ nullable: true, schema: Schema.DateFromMillis }),
    },
    indexes: [{ name: "idx_sessionTaskFields_task", columns: ["taskId"] }],
  }),
  taskRecords: State.SQLite.table({
    name: "taskRecords",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      sessionId: State.SQLite.text({ default: "" }),
      taskId: State.SQLite.integer({ default: 0 }),
      taskType: State.SQLite.text({ default: "single" }),
      startedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromMillis }),
      endedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromMillis }),
    },
    indexes: [{ name: "idx_taskRecords_session", columns: ["sessionId"] }],
  }),
  taskSectionRecords: State.SQLite.table({
    name: "taskSectionRecords",
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      taskRecordId: State.SQLite.text({ default: "" }),
      sectionName: State.SQLite.text({ default: "" }),
      value: State.SQLite.text({ default: "" }),
      sectionType: State.SQLite.text({ default: "" }),
      isRequired: State.SQLite.integer({ default: 0 }),
      startedAt: State.SQLite.integer({ nullable: true, schema: Schema.DateFromMillis }),
    },
    indexes: [{ name: "idx_taskSectionRecords_record", columns: ["taskRecordId"] }],
  }),
};

// ── Events ────────────────────────────────────────────────────────────────

export const events = {
  templateCreated: Events.synced({
    name: "v2.TemplateCreated",
    schema: Schema.Struct({ id: Schema.String, name: Schema.String, isDefault: Schema.Boolean }),
  }),
  /** Full editor save: template metadata + wholesale field replacement, atomic. */
  templateUpdated: Events.synced({
    name: "v2.TemplateUpdated",
    schema: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      isDefault: Schema.Boolean,
      fields: Schema.Array(FieldDef),
    }),
  }),
  /** Wholesale field replacement (used by duplicate). */
  fieldsReplaced: Events.synced({
    name: "v2.FieldsReplaced",
    schema: Schema.Struct({ templateId: Schema.String, fields: Schema.Array(FieldDef) }),
  }),
  templateDeleted: Events.synced({
    name: "v2.TemplateDeleted",
    schema: Schema.Struct({ id: Schema.String }),
  }),
  /** Clears other defaults, then sets the given template as the sole default. */
  templateDefaultSet: Events.synced({
    name: "v2.TemplateDefaultSet",
    schema: Schema.Struct({ id: Schema.String }),
  }),
  /** Atomic first-boot seeding of sample content (never leaves user template-less). */
  templatesSeeded: Events.synced({
    name: "v2.TemplatesSeeded",
    schema: Schema.Struct({
      templates: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          isDefault: Schema.Boolean,
          fields: Schema.Array(FieldDef),
        }),
      ),
    }),
  }),

  // ── Sessions ────────────────────────────────────────────────────────────
  sessionStarted: Events.synced({
    name: "v2.SessionStarted",
    schema: Schema.Struct({
      id: Schema.String,
      templateId: Schema.Union([Schema.Null, Schema.String]),
      templateName: Schema.String,
      sessionName: Schema.String,
    }),
  }),
  sessionRenamed: Events.synced({
    name: "v2.SessionRenamed",
    schema: Schema.Struct({ id: Schema.String, sessionName: Schema.String }),
  }),
  /**
   * Ends a session: stamps endedAt and archives finished tasks into history
   * records. When zero finished tasks exist the materializer no-ops so the
   * caller can delete the whole session instead.
   */
  sessionEnded: Events.synced({
    name: "v2.SessionEnded",
    schema: Schema.Struct({
      id: Schema.String,
      endedAt: Schema.DateFromMillis,
      records: Schema.Array(
        Schema.Struct({
          taskIdNumber: Schema.Number,
          taskType: Schema.String,
          startedAt: Schema.Union([Schema.Null, Schema.DateFromMillis]),
          endedAt: Schema.Union([Schema.Null, Schema.DateFromMillis]),
          sections: Schema.Array(
            Schema.Struct({
              sectionName: Schema.String,
              value: Schema.String,
              sectionType: Schema.String,
              isRequired: Schema.Boolean,
              startedAt: Schema.Union([Schema.Null, Schema.DateFromMillis]),
            }),
          ),
        }),
      ),
    }),
  }),
  /** Deletes a session's live graph (tasks + their fields). */
  sessionLiveGraphCleared: Events.synced({
    name: "v2.SessionLiveGraphCleared",
    schema: Schema.Struct({ sessionId: Schema.String }),
  }),
  /** Deletes an archived session with all its records (cascade semantics). */
  sessionDeleted: Events.synced({
    name: "v2.SessionDeleted",
    schema: Schema.Struct({ id: Schema.String }),
  }),

  // ── Live tasks ──────────────────────────────────────────────────────────
  taskSpawned: Events.synced({
    name: "v2.TaskSpawned",
    schema: Schema.Struct({
      sessionId: Schema.String,
      id: Schema.String,
      orderIndex: Schema.Number,
      fields: Schema.Array(FieldDef),
    }),
  }),
  taskFinished: Events.synced({
    name: "v2.TaskFinished",
    schema: Schema.Struct({ id: Schema.String, endedAt: Schema.DateFromMillis }),
  }),
  taskReopened: Events.synced({
    name: "v2.TaskReopened",
    schema: Schema.Struct({ id: Schema.String }),
  }),
  /** Clears edit flags on every task of the session, then flags the target. */
  taskEditStarted: Events.synced({
    name: "v2.TaskEditStarted",
    schema: Schema.Struct({ sessionId: Schema.String, id: Schema.String }),
  }),
  taskEditFinished: Events.synced({
    name: "v2.TaskEditFinished",
    schema: Schema.Struct({ id: Schema.String }),
  }),
  /**
   * Writes a live field value; startDate stamped on FIRST write only
   * (COALESCE keeps the earliest timestamp — first-write-wins).
   */
  taskFieldValueChanged: Events.synced({
    name: "v2.TaskFieldValueChanged",
    schema: Schema.Struct({ id: Schema.String, value: Schema.String, now: Schema.DateFromMillis }),
  }),
  /** Restores a value WITHOUT touching startDate (edit-cancel rollback). */
  taskFieldValueRestored: Events.synced({
    name: "v2.TaskFieldValueRestored",
    schema: Schema.Struct({ id: Schema.String, value: Schema.String }),
  }),
};

// ── Materializers ─────────────────────────────────────────────────────────

const insertTemplateFields = (templateId: string, fields: ReadonlyArray<FieldDef>) =>
  fields.map((field) =>
    tables.templateFields.insert({
      id: field.id,
      templateId,
      name: field.name,
      kind: field.kind,
      isRequired: field.isRequired ? 1 : 0,
      defaultValue: field.defaultValue,
      sortOrder: field.sortOrder,
      optionsJson: JSON.stringify(field.options),
      exclusiveOptionsJson: JSON.stringify(field.exclusiveOptions),
    }),
  );

const insertSessionTaskFields = (taskId: string, fields: ReadonlyArray<FieldDef>) =>
  fields.map((field) =>
    tables.sessionTaskFields.insert({
      id: crypto.randomUUID(),
      taskId,
      name: field.name,
      kind: field.kind,
      isRequired: field.isRequired ? 1 : 0,
      defaultValue: field.defaultValue,
      sortOrder: field.sortOrder,
      optionsJson: JSON.stringify(field.options),
      exclusiveOptionsJson: JSON.stringify(field.exclusiveOptions),
      // Pre-filled with the template default; startDate stays nil until touched
      value: field.defaultValue,
      startDate: null,
    }),
  );

const materializers = State.SQLite.materializers(events, {
  "v2.TemplateCreated": ({ id, name, isDefault }) =>
    tables.templates.insert({
      id,
      name,
      isDefault: isDefault ? 1 : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  "v2.TemplateUpdated": ({ id, name, isDefault, fields }) => [
    ...(isDefault
      ? [tables.templates.update({ isDefault: 0 }).where({ id: { op: "!=", value: id } })]
      : []),
    tables.templates
      .update({ name, isDefault: isDefault ? 1 : 0, updatedAt: new Date() })
      .where({ id }),
    tables.templateFields.delete().where({ templateId: id }),
    ...insertTemplateFields(id, fields),
  ],
  "v2.FieldsReplaced": ({ templateId, fields }) => [
    tables.templateFields.delete().where({ templateId }),
    ...insertTemplateFields(templateId, fields),
  ],
  "v2.TemplateDeleted": ({ id }) => [
    tables.templates.delete().where({ id }),
    tables.templateFields.delete().where({ templateId: id }),
  ],
  "v2.TemplateDefaultSet": ({ id }) => [
    tables.templates.update({ isDefault: 0 }).where({ id: { op: "!=", value: id } }),
    tables.templates.update({ isDefault: 1 }).where({ id }),
  ],
  "v2.TemplatesSeeded": ({ templates }) =>
    templates.flatMap((t) => [
      tables.templates.insert({
        id: t.id,
        name: t.name,
        isDefault: t.isDefault ? 1 : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      ...insertTemplateFields(t.id, t.fields),
    ]),

  "v2.SessionStarted": ({ id, templateId, templateName, sessionName }) =>
    tables.sessions.insert({
      id,
      templateId,
      templateName,
      sessionName,
      startedAt: new Date(),
      endedAt: null,
    }),
  "v2.SessionRenamed": ({ id, sessionName }) =>
    tables.sessions.update({ sessionName }).where({ id }),
  "v2.SessionEnded": ({ id, endedAt, records }, { query }) => {
    const rows = query({
      query:
        "select count(*) as count from sessionTasks where sessionId = $id and endDate is not null",
      bindValues: { id },
    }) as ReadonlyArray<{ readonly count: number }>;
    if ((rows[0]?.count ?? 0) < 1) return [];
    return [
      tables.sessions.update({ endedAt: new Date(endedAt) }).where({ id }),
      ...records.flatMap((record) => {
        const recordId = crypto.randomUUID();
        return [
          tables.taskRecords.insert({
            id: recordId,
            sessionId: id,
            taskId: record.taskIdNumber,
            taskType: record.taskType,
            startedAt: record.startedAt === null ? null : new Date(record.startedAt),
            endedAt: record.endedAt === null ? null : new Date(record.endedAt),
          }),
          ...record.sections.map((section) =>
            tables.taskSectionRecords.insert({
              id: crypto.randomUUID(),
              taskRecordId: recordId,
              sectionName: section.sectionName,
              value: section.value,
              sectionType: section.sectionType,
              isRequired: section.isRequired ? 1 : 0,
              startedAt: section.startedAt === null ? null : new Date(section.startedAt),
            }),
          ),
        ];
      }),
    ];
  },
  "v2.SessionLiveGraphCleared": ({ sessionId }) => [
    {
      sql: "delete from sessionTaskFields where taskId in (select id from sessionTasks where sessionId = $sessionId)",
      bindValues: { sessionId },
      writeTables: new Set(["sessionTaskFields"]),
    },
    {
      sql: "delete from sessionTasks where sessionId = $sessionId",
      bindValues: { sessionId },
      writeTables: new Set(["sessionTasks"]),
    },
  ],
  "v2.SessionDeleted": ({ id }) => [
    {
      sql: "delete from taskSectionRecords where taskRecordId in (select id from taskRecords where sessionId = $id)",
      bindValues: { id },
      writeTables: new Set(["taskSectionRecords"]),
    },
    {
      sql: "delete from taskRecords where sessionId = $id",
      bindValues: { id },
      writeTables: new Set(["taskRecords"]),
    },
    tables.sessions.delete().where({ id }),
  ],

  "v2.TaskSpawned": ({ sessionId, id, orderIndex, fields }) => [
    tables.sessionTasks.insert({
      id,
      sessionId,
      orderIndex,
      taskType: "single",
      endDate: null,
      isBeingEdited: 0,
    }),
    ...insertSessionTaskFields(id, fields),
  ],
  "v2.TaskFinished": ({ id, endedAt }) =>
    tables.sessionTasks.update({ endDate: new Date(endedAt) }).where({ id }),
  "v2.TaskReopened": ({ id }) =>
    tables.sessionTasks.update({ endDate: null, isBeingEdited: 1 }).where({ id }),
  "v2.TaskEditStarted": ({ sessionId, id }) => [
    tables.sessionTasks.update({ isBeingEdited: 0 }).where({ sessionId }),
    tables.sessionTasks.update({ isBeingEdited: 1 }).where({ id }),
  ],
  "v2.TaskEditFinished": ({ id }) => tables.sessionTasks.update({ isBeingEdited: 0 }).where({ id }),
  // COALESCE = first-write-only startDate.
  // Raw SQL with $named binds: the `sql` template tag inlines values
  // unquoted (String(arg)), which breaks on uuids/dates ("near 'Aug': syntax
  // error"), so values MUST go through bindValues.
  "v2.TaskFieldValueChanged": ({ id, value, now }) => ({
    sql: "update sessionTaskFields set value = $value, startDate = coalesce(startDate, $now) where id = $id",
    bindValues: { value, now: now.getTime(), id },
    writeTables: new Set(["sessionTaskFields"]),
  }),
  "v2.TaskFieldValueRestored": ({ id, value }) =>
    tables.sessionTaskFields.update({ value }).where({ id }),
});

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });
