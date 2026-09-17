import { Effect, Queue, Stream } from "effect";
import { managedStream } from "./managedStream";
import { Message } from "../messages";
import { getStore } from "../livestore/client";
import { tables } from "../livestore/schema";

const toEpoch = (value: number | Date): number =>
  value instanceof Date ? value.getTime() : Number(value);

type HistorySessionRow = {
  readonly id: string;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number | Date;
  readonly endedAt: number | Date | null;
};
type TaskRecordRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: number;
  readonly startedAt: number | Date | null;
  readonly endedAt: number | Date | null;
};
type TaskSectionRow = {
  readonly id: string;
  readonly taskRecordId: string;
  readonly sectionName: string;
  readonly value: string;
  readonly sectionType: string;
  readonly isRequired: number;
  readonly startedAt: number | Date | null;
};

const toHistorySection = (section: TaskSectionRow) => ({
  sectionName: section.sectionName,
  value: section.value,
  sectionType: section.sectionType,
  isRequired: section.isRequired === 1,
  startedAt:
    section.startedAt === null || section.startedAt === undefined
      ? null
      : toEpoch(section.startedAt),
});

export const historyStream: Stream.Stream<Message> = managedStream((queue) =>
  Effect.promise(async () => {
    const store = await getStore();
    let latestSessions: ReadonlyArray<HistorySessionRow> = [];
    let latestRecords: ReadonlyArray<TaskRecordRow> = [];

    const push = () => {
      const counts = new Map<string, number>();
      for (const r of latestRecords as ReadonlyArray<TaskRecordRow>) {
        counts.set(r.sessionId, (counts.get(r.sessionId) ?? 0) + 1);
      }
      const history = (latestSessions as ReadonlyArray<HistorySessionRow>)
        .filter((s) => s.endedAt !== null && s.endedAt !== undefined)
        .map((s) => {
          const displayName = s.sessionName !== "" ? s.sessionName : s.templateName;
          return {
            id: s.id,
            displayName,
            templateName: s.templateName,
            sessionName: s.sessionName,
            startedAt: toEpoch(s.startedAt),
            endedAt: toEpoch(s.endedAt as number | Date),
            taskCount: counts.get(s.id) ?? 0,
          };
        })
        .toSorted((a, b) => b.startedAt - a.startedAt);
      Queue.offerUnsafe(queue, Message.GotHistory({ history }));
    };

    const unsubscribeSessions = store.subscribe(tables.sessions.select(), (rows) => {
      latestSessions = rows as unknown as ReadonlyArray<HistorySessionRow>;
      push();
    });
    const unsubscribeRecords = store.subscribe(tables.taskRecords.select(), (rows) => {
      latestRecords = rows as unknown as ReadonlyArray<TaskRecordRow>;
      push();
    });
    return [unsubscribeSessions, unsubscribeRecords] as const;
  }),
);

export const historyDetailStream = (sessionId: string): Stream.Stream<Message> =>
  managedStream((queue) =>
    Effect.promise(async () => {
      const store = await getStore();
      let latestSessions: ReadonlyArray<HistorySessionRow> = [];
      let latestRecords: ReadonlyArray<TaskRecordRow> = [];
      let latestSections: ReadonlyArray<TaskSectionRow> = [];
      let sessionsLoaded = false;

      const push = () => {
        if (!sessionsLoaded) return;
        const session =
          (latestSessions as ReadonlyArray<HistorySessionRow>).find((s) => s.id === sessionId) ??
          null;
        if (session === null || session.endedAt === null || session.endedAt === undefined) {
          Queue.offerUnsafe(queue, Message.GotHistoryDetail({ detail: null }));
          return;
        }
        const recordsForSession = (latestRecords as ReadonlyArray<TaskRecordRow>).filter(
          (r) => r.sessionId === sessionId,
        );
        const sectionsByRecord = new Map<string, ReadonlyArray<TaskSectionRow>>();
        for (const sec of latestSections as ReadonlyArray<TaskSectionRow>) {
          const arr = sectionsByRecord.get(sec.taskRecordId) ?? [];
          (sectionsByRecord as Map<string, Array<TaskSectionRow>>).set(sec.taskRecordId, [
            ...(arr as Array<TaskSectionRow>),
            sec,
          ]);
        }
        const tasks = recordsForSession
          .map((r) => {
            const secs = sectionsByRecord.get(r.id) ?? [];
            return {
              id: r.id,
              taskId: Number(r.taskId),
              startedAt:
                r.startedAt === null || r.startedAt === undefined
                  ? null
                  : toEpoch(r.startedAt as number | Date),
              endedAt:
                r.endedAt === null || r.endedAt === undefined
                  ? null
                  : toEpoch(r.endedAt as number | Date),
              sections: secs.map(toHistorySection),
            };
          })
          .toSorted((a, b) => a.taskId - b.taskId);
        Queue.offerUnsafe(
          queue,
          Message.GotHistoryDetail({
            detail: {
              id: session.id,
              sessionName: session.sessionName,
              templateName: session.templateName,
              startedAt: toEpoch(session.startedAt),
              endedAt:
                session.endedAt === null || session.endedAt === undefined
                  ? null
                  : toEpoch(session.endedAt as number | Date),
              taskCount: tasks.length,
              tasks,
            },
          }),
        );
      };

      const unsubSessions = store.subscribe(
        tables.sessions.select().where({ id: sessionId }),
        (rows) => {
          latestSessions = rows as unknown as ReadonlyArray<HistorySessionRow>;
          sessionsLoaded = true;
          push();
        },
      );
      const unsubRecords = store.subscribe(
        tables.taskRecords.select().where({ sessionId }),
        (rows) => {
          latestRecords = rows as unknown as ReadonlyArray<TaskRecordRow>;
          push();
        },
      );
      const unsubSections = store.subscribe(tables.taskSectionRecords.select(), (rows) => {
        latestSections = rows as unknown as ReadonlyArray<TaskSectionRow>;
        push();
      });
      return [unsubSessions, unsubRecords, unsubSections] as const;
    }),
  );
