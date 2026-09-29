import type { Stream } from "effect";
import { storeStream } from "./managedStream";
import { Message } from "../messages";
import type { SessionTaskFieldRow, SessionTaskRow } from "../livestore/queries";
import { safeArray, toFieldKind } from "../web/fieldRows";

export const activeSessionStream: Stream.Stream<Message> = storeStream(
  Message.StoreUnavailable(),
  ({ store, queries }, emit) => [
    store.subscribe(queries.activeSession, (activeSession) =>
      emit(Message.GotActiveSession({ activeSession })),
    ),
  ],
);

const toRunnerSection = (row: SessionTaskFieldRow) => ({
  id: row.id,
  taskId: row.taskId,
  name: row.name,
  kind: toFieldKind(row.kind),
  isRequired: row.isRequired === 1,
  defaultValue: row.defaultValue,
  sortOrder: row.sortOrder,
  options: safeArray(row.optionsJson),
  exclusiveOptions: safeArray(row.exclusiveOptionsJson),
  value: row.value,
  startDate: row.startDate?.getTime() ?? null,
});

/** Groups fields by task; `fields` arrive ordered by sortOrder. */
const groupByTask = (fields: ReadonlyArray<SessionTaskFieldRow>) => {
  const byTask = new Map<string, Array<SessionTaskFieldRow>>();
  for (const field of fields) {
    const group = byTask.get(field.taskId);
    if (group === undefined) byTask.set(field.taskId, [field]);
    else group.push(field);
  }
  return byTask;
};

/** Edited task first, else the newest unfinished task, else the newest task. */
const currentTaskIdOf = (
  tasks: ReadonlyArray<{ id: string; endDate: number | null; isBeingEdited: boolean }>,
): string | null =>
  tasks.find((task) => task.isBeingEdited)?.id ??
  tasks.findLast((task) => task.endDate === null)?.id ??
  tasks.at(-1)?.id ??
  null;

const toRunnerTasks = (
  taskRows: ReadonlyArray<SessionTaskRow>,
  fields: ReadonlyArray<SessionTaskFieldRow>,
) => {
  const fieldsByTask = groupByTask(fields);
  return taskRows.map((task) => ({
    id: task.id,
    orderIndex: task.orderIndex,
    endDate: task.endDate?.getTime() ?? null,
    isBeingEdited: task.isBeingEdited === 1,
    sections: (fieldsByTask.get(task.id) ?? []).map(toRunnerSection),
  }));
};

export const runnerStream = (sessionId: string): Stream.Stream<Message> =>
  storeStream(Message.StoreUnavailable(), ({ store, queries }, emit) => [
    store.subscribe(queries.runnerRows(sessionId), ({ session, tasks: taskRows, fields }) => {
      if (session === null || session.endedAt !== null) {
        emit(Message.GotRunnerData({ data: null }));
        return;
      }
      // Tasks arrive ordered by orderIndex.
      const tasks = toRunnerTasks(taskRows, fields);
      emit(
        Message.GotRunnerData({
          data: {
            sessionId: session.id,
            templateName: session.templateName,
            sessionName: session.sessionName,
            startedAt: session.startedAt.getTime(),
            tasks,
            currentTaskId: currentTaskIdOf(tasks),
            completedCount: tasks.filter((task) => task.endDate !== null).length,
          },
        }),
      );
    }),
  ]);
