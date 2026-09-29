import { computed, queryDb } from "@livestore/livestore";
import { Schema } from "effect";

import { tables } from "./schema";

// Reactive reads. Each stream subscribes to one query, so a commit that
// touches several tables produces one consistent result instead of a
// sequence of partial ones, and each query reads only the rows it shows.

const ArchivedSessionRow = Schema.Struct({
  id: Schema.String,
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  endedAt: Schema.Number,
  taskCount: Schema.Number,
});
type ArchivedSessionRow = typeof ArchivedSessionRow.Type;

/** Archived sessions, newest first, with task counts from SQL. */
export const archivedSessions = queryDb(
  {
    query: `select s.id, s.templateName, s.sessionName, s.startedAt, s.endedAt,
      (select count(*) from taskRecords r where r.sessionId = s.id) as taskCount
      from sessions s where s.endedAt is not null
      order by s.startedAt desc, s.id asc`,
    schema: Schema.Array(ArchivedSessionRow),
  },
  { label: "archivedSessions" },
);

const ActiveSessionRow = Schema.Struct({
  id: Schema.String,
  templateId: Schema.NullOr(Schema.String),
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  completedCount: Schema.Number,
});
type ActiveSessionRow = typeof ActiveSessionRow.Type;

/** The most recently started live session with its finished-task count. */
export const activeSession = queryDb(
  {
    query: `select s.id, s.templateId, s.templateName, s.sessionName, s.startedAt,
      (select count(*) from sessionTasks t where t.sessionId = s.id and t.endDate is not null)
        as completedCount
      from sessions s where s.endedAt is null
      order by s.startedAt desc limit 1`,
    schema: Schema.Array(ActiveSessionRow),
  },
  { label: "activeSession", map: (rows) => rows[0] ?? null },
);

type SessionRow = typeof tables.sessions.Type;
export type SessionTaskRow = typeof tables.sessionTasks.Type;
export type SessionTaskFieldRow = typeof tables.sessionTaskFields.Type;
export type TaskSectionRow = typeof tables.taskSectionRecords.Type;

const sessionById = (sessionId: string) =>
  queryDb(tables.sessions.select().where({ id: sessionId }), {
    label: `session:${sessionId}`,
    deps: [sessionId],
    map: (rows): SessionRow | null => rows[0] ?? null,
  });

/** One live session's tasks and their fields. */
export const runnerRows = (sessionId: string) => {
  const session$ = sessionById(sessionId);
  const tasks$ = queryDb(
    tables.sessionTasks.select().where({ sessionId }).orderBy("orderIndex", "asc"),
    { label: `runnerTasks:${sessionId}`, deps: [sessionId] },
  );
  const fields$ = queryDb(
    {
      query: `select f.* from sessionTaskFields f
        join sessionTasks t on t.id = f.taskId
        where t.sessionId = $sessionId
        order by f.sortOrder asc`,
      bindValues: { sessionId },
      schema: Schema.Array(tables.sessionTaskFields.rowSchema),
    },
    { label: `runnerFields:${sessionId}`, deps: [sessionId] },
  );
  return computed((get) => ({ session: get(session$), tasks: get(tasks$), fields: get(fields$) }), {
    label: `runner:${sessionId}`,
    deps: [sessionId],
  });
};

const sectionsForSessionQuery = (sessionId: string) => ({
  query: `select sr.* from taskSectionRecords sr
    join taskRecords r on r.id = sr.taskRecordId
    where r.sessionId = $sessionId
    order by sr.taskRecordId asc, sr.position asc`,
  bindValues: { sessionId },
  schema: Schema.Array(tables.taskSectionRecords.rowSchema),
});

/** One archived session's records and their answers. */
export const archiveRows = (sessionId: string) => {
  const session$ = sessionById(sessionId);
  const records$ = queryDb(
    tables.taskRecords.select().where({ sessionId }).orderBy("taskId", "asc"),
    { label: `archiveRecords:${sessionId}`, deps: [sessionId] },
  );
  const sections$ = queryDb(sectionsForSessionQuery(sessionId), {
    label: `archiveSections:${sessionId}`,
    deps: [sessionId],
  });
  return computed(
    (get) => ({ session: get(session$), records: get(records$), sections: get(sections$) }),
    { label: `archive:${sessionId}`, deps: [sessionId] },
  );
};

const TemplateSummaryRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isDefault: Schema.Number,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  fieldCount: Schema.Number,
  requiredCount: Schema.Number,
});
type TemplateSummaryRow = typeof TemplateSummaryRow.Type;

/** Templates with question counts from SQL. */
export const templateSummaries = queryDb(
  {
    query: `select t.id, t.name, t.isDefault, t.createdAt, t.updatedAt,
      count(f.id) as fieldCount, coalesce(sum(f.isRequired), 0) as requiredCount
      from templates t left join templateFields f on f.templateId = t.id
      group by t.id`,
    schema: Schema.Array(TemplateSummaryRow),
  },
  { label: "templateSummaries" },
);

/** One template and its questions in order. */
export const templateRows = (templateId: string) => {
  const template$ = queryDb(tables.templates.select().where({ id: templateId }), {
    label: `template:${templateId}`,
    deps: [templateId],
    map: (rows) => rows[0] ?? null,
  });
  const fields$ = queryDb(
    tables.templateFields.select().where({ templateId }).orderBy("sortOrder", "asc"),
    { label: `templateFields:${templateId}`, deps: [templateId] },
  );
  return computed((get) => ({ template: get(template$), fields: get(fields$) }), {
    label: `templateDetail:${templateId}`,
    deps: [templateId],
  });
};
