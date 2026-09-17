import { Effect, Queue, Stream } from "effect";
import { managedStream } from "./managedStream";
import { Message } from "../messages";
import { getStore } from "../livestore/client";
import { tables } from "../livestore/schema";
import { safeArray } from "../web/fieldRows";

type ActiveSessionRow = {
  readonly id: string;
  readonly templateId: string | null;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number | Date;
  readonly endedAt: number | Date | null;
};
type TaskRowLite = { readonly sessionId: string; readonly endDate: number | Date | null };

const toEpoch = (value: number | Date): number =>
  value instanceof Date ? value.getTime() : Number(value);

export const activeSessionStream: Stream.Stream<Message> = managedStream((queue) =>
  Effect.promise(async () => {
    const store = await getStore();
    let latestSessions: ReadonlyArray<ActiveSessionRow> = [];
    let latestTasks: ReadonlyArray<TaskRowLite> = [];

    const push = () => {
      const liveSessions = (latestSessions as ReadonlyArray<ActiveSessionRow>).filter(
        (row) => row.endedAt === null || row.endedAt === undefined,
      );
      if (liveSessions.length === 0) {
        Queue.offerUnsafe(queue, Message.GotActiveSession({ activeSession: null }));
        return;
      }
      // Most recent live session by startedAt desc
      const sorted = [...liveSessions].toSorted(
        (a, b) => toEpoch(b.startedAt) - toEpoch(a.startedAt),
      );
      const active = sorted[0] as ActiveSessionRow;
      const completedCount = (latestTasks as ReadonlyArray<TaskRowLite>).filter(
        (task) =>
          task.sessionId === active.id && task.endDate !== null && task.endDate !== undefined,
      ).length;
      Queue.offerUnsafe(
        queue,
        Message.GotActiveSession({
          activeSession: {
            id: active.id,
            templateId: active.templateId,
            templateName: active.templateName,
            sessionName: active.sessionName,
            startedAt: toEpoch(active.startedAt),
            completedCount,
          },
        }),
      );
    };

    const unsubscribeSessions = store.subscribe(tables.sessions.select(), (rows) => {
      latestSessions = rows as unknown as ReadonlyArray<ActiveSessionRow>;
      push();
    });
    const unsubscribeTasks = store.subscribe(tables.sessionTasks.select(), (rows) => {
      latestTasks = rows as unknown as ReadonlyArray<TaskRowLite>;
      push();
    });
    return [unsubscribeSessions, unsubscribeTasks] as const;
  }),
);

type RunnerSessionRow = {
  readonly id: string;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number | Date;
  readonly endedAt: number | Date | null;
};
type RunnerTaskRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly orderIndex: number;
  readonly endDate: number | Date | null;
  readonly isBeingEdited: number;
};
type RunnerFieldRow = {
  readonly id: string;
  readonly taskId: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: number;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly optionsJson: string;
  readonly exclusiveOptionsJson: string;
  readonly value: string;
  readonly startDate: number | Date | null;
};

const compareRunnerFields = (left: RunnerFieldRow, right: RunnerFieldRow) =>
  Number(left.sortOrder) - Number(right.sortOrder);

const toRunnerSection = (row: RunnerFieldRow) => ({
  id: row.id,
  taskId: row.taskId,
  name: row.name,
  kind: row.kind,
  isRequired: row.isRequired === 1,
  defaultValue: row.defaultValue,
  sortOrder: Number(row.sortOrder),
  options: safeArray(row.optionsJson),
  exclusiveOptions: safeArray(row.exclusiveOptionsJson),
  value: row.value,
  startDate: row.startDate === null || row.startDate === undefined ? null : toEpoch(row.startDate),
});

export const runnerStream = (sessionId: string): Stream.Stream<Message> =>
  managedStream((queue) =>
    Effect.promise(async () => {
      const store = await getStore();
      let latestSessions: ReadonlyArray<RunnerSessionRow> = [];
      let latestTasks: ReadonlyArray<RunnerTaskRow> = [];
      let latestFields: ReadonlyArray<RunnerFieldRow> = [];
      let sessionsLoaded = false;

      const push = () => {
        if (!sessionsLoaded) return;
        const session =
          (latestSessions as ReadonlyArray<RunnerSessionRow>).find((s) => s.id === sessionId) ??
          null;
        if (session === null || (session.endedAt !== null && session.endedAt !== undefined)) {
          Queue.offerUnsafe(queue, Message.GotRunnerData({ data: null }));
          return;
        }
        const tasksForSession = (latestTasks as ReadonlyArray<RunnerTaskRow>).filter(
          (t) => t.sessionId === sessionId,
        );
        const sortedTasks = [...tasksForSession].toSorted(
          (a, b) => Number(a.orderIndex) - Number(b.orderIndex),
        );
        const taskIds = new Set(sortedTasks.map((t) => t.id));
        const fieldsByTask = new Map<string, ReadonlyArray<RunnerFieldRow>>();
        for (const f of latestFields as ReadonlyArray<RunnerFieldRow>) {
          if (!taskIds.has(f.taskId)) continue;
          const arr = fieldsByTask.get(f.taskId) ?? [];
          (fieldsByTask as Map<string, Array<RunnerFieldRow>>).set(f.taskId, [
            ...(arr as Array<RunnerFieldRow>),
            f,
          ]);
        }
        const tasks = sortedTasks.map((t) => {
          const sections = [...(fieldsByTask.get(t.id) ?? [])]
            .toSorted(compareRunnerFields)
            .map(toRunnerSection);
          return {
            id: t.id,
            orderIndex: Number(t.orderIndex),
            endDate:
              t.endDate === null || t.endDate === undefined
                ? null
                : toEpoch(t.endDate as number | Date),
            isBeingEdited: t.isBeingEdited === 1,
            sections,
          };
        });
        // Determine currentTaskId (prefers edited, else unfinished with max orderIndex)
        const edited = tasks.find((t) => t.isBeingEdited);
        let currentTaskId: string | null = null;
        if (edited !== undefined) currentTaskId = edited.id;
        else {
          const unfinished = tasks.filter((t) => t.endDate === null);
          if (unfinished.length > 0) {
            const latest = unfinished.reduce((a, b) => (a.orderIndex > b.orderIndex ? a : b));
            currentTaskId = latest.id;
          } else if (tasks.length > 0) {
            currentTaskId = tasks[tasks.length - 1]?.id ?? null;
          }
        }
        const completedCount = tasks.filter((t) => t.endDate !== null).length;
        Queue.offerUnsafe(
          queue,
          Message.GotRunnerData({
            data: {
              sessionId: session.id,
              templateName: session.templateName,
              sessionName: session.sessionName,
              startedAt: toEpoch(session.startedAt),
              tasks,
              currentTaskId,
              completedCount,
            },
          }),
        );
      };

      const unsubscribeSessions = store.subscribe(
        tables.sessions.select().where({ id: sessionId }),
        (rows) => {
          latestSessions = rows as unknown as ReadonlyArray<RunnerSessionRow>;
          sessionsLoaded = true;
          push();
        },
      );
      const unsubscribeTasks = store.subscribe(
        tables.sessionTasks.select().where({ sessionId }),
        (rows) => {
          latestTasks = rows as unknown as ReadonlyArray<RunnerTaskRow>;
          push();
        },
      );
      const unsubscribeFields = store.subscribe(tables.sessionTaskFields.select(), (rows) => {
        latestFields = rows as unknown as ReadonlyArray<RunnerFieldRow>;
        push();
      });
      // initial push will happen via subscribe callbacks
      return [unsubscribeSessions, unsubscribeTasks, unsubscribeFields] as const;
    }),
  );
