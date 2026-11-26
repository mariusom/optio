import { Array, Order } from "effect";

import {
  byColumn,
  rowsWhere,
  type Query,
  type SessionRow,
  type StoreState,
  type TaskRecordRow,
  type TaskSectionRow,
} from "./tables";

export type { SessionTaskFieldRow, SessionTaskRow, TaskSectionRow } from "./tables";

// Reads for the streams. Each stream runs one query, so a commit that touches
// several tables produces one consistent result instead of a sequence of
// partial ones, and each query reads only the rows it shows.

const query = <A>(run: (state: StoreState) => A): Query<A> => ({ run });

const millis = (date: Date) => date.getTime();

/** Archived sessions, newest first, with their task counts. */
export const archivedSessions = query((state) =>
  Array.map(
    Array.sort(
      rowsWhere(state, "sessions", { endedAt: { op: "!=", value: null } }),
      Order.combine(byColumn<SessionRow>("startedAt", "desc"), byColumn<SessionRow>("id")),
    ),
    (session) => ({
      id: session.id,
      templateName: session.templateName,
      sessionName: session.sessionName,
      startedAt: millis(session.startedAt),
      endedAt: millis(session.endedAt!),
      taskCount: rowsWhere(state, "taskRecords", { sessionId: session.id }).length,
    }),
  ),
);

/** The most recently started live session with its finished-task count. */
export const activeSession = query((state) => {
  const session = Array.sort(
    rowsWhere(state, "sessions", { endedAt: null }),
    byColumn<SessionRow>("startedAt", "desc"),
  )[0];
  if (session === undefined) return null;
  return {
    id: session.id,
    templateId: session.templateId,
    templateName: session.templateName,
    sessionName: session.sessionName,
    startedAt: millis(session.startedAt),
    completedCount: rowsWhere(state, "sessionTasks", {
      sessionId: session.id,
      endDate: { op: "!=", value: null },
    }).length,
  };
});

const sessionById = (state: StoreState, sessionId: string): SessionRow | null =>
  state.sessions.get(sessionId) ?? null;

/** One live session's tasks and their fields. */
export const runnerRows = (sessionId: string) =>
  query((state) => {
    const tasks = Array.sort(
      rowsWhere(state, "sessionTasks", { sessionId }),
      byColumn("orderIndex"),
    );
    return {
      session: sessionById(state, sessionId),
      tasks,
      fields: Array.sort(
        Array.flatMap(tasks, (task) => rowsWhere(state, "sessionTaskFields", { taskId: task.id })),
        byColumn("sortOrder"),
      ),
    };
  });

const sectionOrder = Order.combine(
  byColumn<TaskSectionRow>("taskRecordId"),
  byColumn<TaskSectionRow>("position"),
);

const sectionsOf = (state: StoreState, records: ReadonlyArray<TaskRecordRow>) =>
  Array.sort(
    Array.flatMap(records, (record) =>
      rowsWhere(state, "taskSectionRecords", { taskRecordId: record.id }),
    ),
    sectionOrder,
  );

/** One archived session's records and their answers. */
export const archiveRows = (sessionId: string) =>
  query((state) => {
    const records = Array.sort(rowsWhere(state, "taskRecords", { sessionId }), byColumn("taskId"));
    return {
      session: sessionById(state, sessionId),
      records,
      sections: sectionsOf(state, records),
    };
  });

/** Templates with question counts. */
export const templateSummaries = query((state) =>
  Array.map(globalThis.Array.from(state.templates.values()), (template) => {
    const fields = rowsWhere(state, "templateFields", { templateId: template.id });
    return {
      id: template.id,
      name: template.name,
      isDefault: template.isDefault,
      createdAt: millis(template.createdAt),
      updatedAt: millis(template.updatedAt),
      fieldCount: fields.length,
      requiredCount: Array.reduce(fields, 0, (count, field) => count + field.isRequired),
    };
  }),
);

/** One template and its questions in order. */
export const templateRows = (templateId: string) =>
  query((state) => ({
    template: state.templates.get(templateId) ?? null,
    fields: Array.sort(rowsWhere(state, "templateFields", { templateId }), byColumn("sortOrder")),
  }));

/** Finished sessions of one template, with their task records and answers. */
export const templateReportRows = (templateId: string) =>
  query((state) => {
    const sessions = Array.sort(
      rowsWhere(state, "sessions", { templateId, endedAt: { op: "!=", value: null } }),
      byColumn<SessionRow>("startedAt"),
    );
    const records = Array.flatMap(sessions, (session) =>
      Array.sort(rowsWhere(state, "taskRecords", { sessionId: session.id }), byColumn("taskId")),
    );
    return {
      summary: {
        sessionCount: sessions.length,
        totalMs: Array.reduce(
          sessions,
          0,
          (total, session) => total + millis(session.endedAt!) - millis(session.startedAt),
        ),
      },
      records,
      sections: sectionsOf(state, records),
    };
  });
