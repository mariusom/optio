import { Array, Record, Schema } from "effect";

import type { FieldDef } from "../domain/fields";
import { uniqueTasks, type ArchiveRecord } from "../domain/archive";
import type { EventName, PayloadOf, StoreEvent } from "./schema";
import {
  byColumn,
  deleteWhere,
  insert,
  rowsWhere,
  updateWhere,
  type StoreState,
  type TableName,
} from "./tables";

// Applies events to the tables. Handlers must be deterministic: they run on
// every write and again on every replay, so times and IDs come from the event.

// @effect-diagnostics-next-line schemaSync:off -- handlers encode validated string arrays synchronously
const encodeOptions = Schema.encodeSync(Schema.fromJsonString(Schema.Array(Schema.String)));

const fieldColumns = (field: FieldDef) => ({
  name: field.name,
  kind: field.kind,
  isRequired: field.isRequired ? 1 : 0,
  defaultValue: field.defaultValue,
  sortOrder: field.sortOrder,
  optionsJson: encodeOptions(field.options),
  exclusiveOptionsJson: encodeOptions(field.exclusiveOptions),
});

const insertTemplateFields = (
  state: StoreState,
  templateId: string,
  fields: ReadonlyArray<FieldDef>,
) => {
  for (const field of fields)
    insert(state, "templateFields", { id: field.id, templateId, ...fieldColumns(field) });
};

const insertTemplate = (
  state: StoreState,
  template: { readonly id: string; readonly name: string; readonly isDefault: boolean },
  now: Date,
) => {
  insert(state, "templates", {
    id: template.id,
    name: template.name,
    isDefault: template.isDefault ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });
};

/** Archived task rows: `<session>:<task>` records with positioned answers. */
const insertArchiveRecords = (
  state: StoreState,
  sessionId: string,
  records: ReadonlyArray<typeof ArchiveRecord.Type>,
) => {
  for (const record of records) {
    const recordId = `${sessionId}:${record.taskIdNumber}`;
    insert(state, "taskRecords", {
      id: recordId,
      sessionId,
      taskId: record.taskIdNumber,
      taskType: record.taskType,
      startedAt: record.startedAt,
      endedAt: record.endedAt,
    });
    for (const [index, section] of record.sections.entries())
      insert(state, "taskSectionRecords", {
        id: `${recordId}:${index}`,
        taskRecordId: recordId,
        sectionName: section.sectionName,
        value: section.value,
        sectionType: section.sectionType,
        isRequired: section.isRequired ? 1 : 0,
        startedAt: section.startedAt,
        position: index,
      });
  }
};

const setOnlyDefault = (state: StoreState, id: string) => {
  updateWhere(state, "templates", {
    where: { id: { op: "!=", value: id } },
    set: { isDefault: 0 },
  });
  updateWhere(state, "templates", { where: { id }, set: { isDefault: 1 } });
};

const deleteTemplate = (state: StoreState, id: string) => {
  deleteWhere(state, "templates", { id });
  deleteWhere(state, "templateFields", { templateId: id });
};

const clearLiveGraph = (state: StoreState, sessionId: string) => {
  for (const task of rowsWhere(state, "sessionTasks", { sessionId }))
    deleteWhere(state, "sessionTaskFields", { taskId: task.id });
  deleteWhere(state, "sessionTasks", { sessionId });
};

const deleteSession = (state: StoreState, id: string) => {
  for (const record of rowsWhere(state, "taskRecords", { sessionId: id }))
    deleteWhere(state, "taskSectionRecords", { taskRecordId: record.id });
  deleteWhere(state, "taskRecords", { sessionId: id });
  deleteWhere(state, "sessions", { id });
};

const isLive = (state: StoreState, id?: string) =>
  rowsWhere(state, "sessions", id === undefined ? { endedAt: null } : { id, endedAt: null })
    .length > 0;

// Seeding can race with another device's seeding (and could race between
// tabs before the store took a lock). Samples whose name already exists are
// skipped, and a default is only claimed when none exists.
const seedTemplates = (state: StoreState, { templates, now }: PayloadOf<"v3.TemplatesSeeded">) => {
  const existing = globalThis.Array.from(state.templates.values());
  const taken = new Set(Array.map(existing, (row) => row.name));
  let hasDefault = Array.some(existing, (row) => row.isDefault === 1);
  for (const template of templates) {
    if (taken.has(template.name)) continue;
    taken.add(template.name);
    const isDefault = template.isDefault && !hasDefault;
    if (isDefault) hasDefault = true;
    insertTemplate(state, { ...template, isDefault }, now);
    insertTemplateFields(state, template.id, template.fields);
  }
};

/**
 * Restores only what is missing, so a repeated or overlapping restore is
 * harmless: a template is skipped when its ID or any question ID exists, a
 * session when its ID exists. Restored templates never take the default. IDs
 * claimed earlier in the same event count as existing, so a file that repeats
 * an ID can never insert it twice.
 */
const restoreBackup = (
  state: StoreState,
  { now, templates, sessions }: PayloadOf<"v3.BackupRestored">,
) => {
  const claimed = new Set<string>();
  const claim = (table: TableName, ids: ReadonlyArray<string>) => {
    const keys = Array.map(ids, (id) => `${table}:${id}`);
    const free =
      new Set(keys).size === keys.length &&
      Array.every(ids, (id, index) => !claimed.has(keys[index]!) && !state[table].has(id));
    if (free) for (const key of keys) claimed.add(key);
    return free;
  };
  for (const template of templates) {
    if (!claim("templates", [template.id])) continue;
    if (
      !claim(
        "templateFields",
        Array.map(template.fields, (field) => field.id),
      )
    )
      continue;
    insertTemplate(state, { ...template, isDefault: false }, now);
    insertTemplateFields(state, template.id, template.fields);
  }
  for (const { records, ...session } of sessions) {
    if (!claim("sessions", [session.id])) continue;
    insert(state, "sessions", session);
    insertArchiveRecords(state, session.id, uniqueTasks(records));
  }
};

// A task only joins a session that is still live: a late record after the
// session ended (or a dropped concurrent start) leaves no orphans.
const spawnTask = (
  state: StoreState,
  { sessionId, id, orderIndex, fields }: PayloadOf<"v2.TaskSpawned">,
) => {
  if (!isLive(state, sessionId)) return;
  insert(state, "sessionTasks", {
    id,
    sessionId,
    orderIndex,
    taskType: "single",
    endDate: null,
    isBeingEdited: 0,
    editBackup: null,
  });
  for (const field of fields)
    insert(state, "sessionTaskFields", {
      // Namespace template field IDs by task: the first task reuses its
      // template's field definitions.
      id: `${id}:${field.id}`,
      taskId: id,
      ...fieldColumns(field),
      // Pre-filled with the template default; startDate stays null until touched.
      value: field.defaultValue,
      startDate: null,
    });
};

const startEdit = (state: StoreState, { sessionId, id }: PayloadOf<"v3.TaskEditStarted">) => {
  const task = rowsWhere(state, "sessionTasks", { id, sessionId })[0];
  if (task === undefined || task.endDate === null) return;
  const backup =
    task.editBackup ??
    Record.fromEntries(
      Array.map(
        Array.sort(rowsWhere(state, "sessionTaskFields", { taskId: id }), byColumn("sortOrder")),
        (field) => [field.id, field.value] as const,
      ),
    );
  updateWhere(state, "sessionTasks", {
    where: { sessionId, id: { op: "!=", value: id } },
    set: { isBeingEdited: 0, editBackup: null },
  });
  updateWhere(state, "sessionTasks", {
    where: { id },
    set: { isBeingEdited: 1, editBackup: backup },
  });
};

const cancelEdit = (state: StoreState, { id }: PayloadOf<"v3.TaskEditCancelled">) => {
  const task = rowsWhere(state, "sessionTasks", { id, isBeingEdited: 1 })[0];
  if (task?.editBackup == null) return;
  for (const [fieldId, value] of Record.toEntries(task.editBackup))
    updateWhere(state, "sessionTaskFields", { where: { id: fieldId, taskId: id }, set: { value } });
  updateWhere(state, "sessionTasks", {
    where: { id },
    set: { isBeingEdited: 0, editBackup: null },
  });
};

type Handlers = {
  readonly [N in EventName]: (state: StoreState, payload: PayloadOf<N>) => void;
};

const handlers: Handlers = {
  "v3.TemplateCreated": (state, { now, ...template }) => insertTemplate(state, template, now),
  "v3.TemplateUpdated": (state, { id, name, isDefault, fields, now }) => {
    if (isDefault)
      updateWhere(state, "templates", {
        where: { id: { op: "!=", value: id } },
        set: { isDefault: 0 },
      });
    updateWhere(state, "templates", {
      where: { id },
      set: { name, isDefault: isDefault ? 1 : 0, updatedAt: now },
    });
    deleteWhere(state, "templateFields", { templateId: id });
    insertTemplateFields(state, id, fields);
  },
  "v2.FieldsReplaced": (state, { templateId, fields }) => {
    deleteWhere(state, "templateFields", { templateId });
    insertTemplateFields(state, templateId, fields);
  },
  "v2.TemplateDeleted": (state, { id }) => deleteTemplate(state, id),
  "v2.TemplateDefaultSet": (state, { id }) => setOnlyDefault(state, id),
  "v3.TemplatesSeeded": seedTemplates,
  // Only one live session may exist; a second start is dropped (and its first
  // task with it, see TaskSpawned).
  "v3.SessionStarted": (state, { now, ...session }) => {
    if (!isLive(state)) insert(state, "sessions", { ...session, startedAt: now, endedAt: null });
  },
  "v2.SessionRenamed": (state, { id, sessionName }) =>
    updateWhere(state, "sessions", { where: { id }, set: { sessionName } }),
  "v2.SessionEnded": (state, { id, endedAt, records }) => {
    const finished = rowsWhere(state, "sessionTasks", {
      sessionId: id,
      endDate: { op: "!=", value: null },
    });
    if (finished.length === 0) return;
    updateWhere(state, "sessions", { where: { id }, set: { endedAt } });
    insertArchiveRecords(state, id, records);
  },
  "v3.BackupRestored": restoreBackup,
  "v2.SessionLiveGraphCleared": (state, { sessionId }) => clearLiveGraph(state, sessionId),
  "v2.SessionDeleted": (state, { id }) => deleteSession(state, id),
  "v2.TaskSpawned": spawnTask,
  // First finish wins: a duplicate record keeps the original end time.
  "v2.TaskFinished": (state, { id, endedAt }) =>
    updateWhere(state, "sessionTasks", { where: { id, endDate: null }, set: { endDate: endedAt } }),
  "v3.TaskEditStarted": startEdit,
  "v2.TaskEditFinished": (state, { id }) =>
    updateWhere(state, "sessionTasks", {
      where: { id },
      set: { isBeingEdited: 0, editBackup: null },
    }),
  "v3.TaskEditCancelled": cancelEdit,
  // The first write stamps startDate; later writes keep it.
  "v2.TaskFieldValueChanged": (state, { id, value, now }) => {
    const field = state.sessionTaskFields.get(id);
    if (field !== undefined)
      insert(state, "sessionTaskFields", { ...field, value, startDate: field.startDate ?? now });
  },
};

/** Applies one event to the tables. */
export const materialize = (state: StoreState, event: StoreEvent) => {
  (handlers[event.name] as (state: StoreState, payload: unknown) => void)(state, event.args);
};
