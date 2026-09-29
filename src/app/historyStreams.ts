import type { Stream } from "effect";
import { storeStream } from "./managedStream";
import { Message } from "../messages";
import type { TaskSectionRow } from "../livestore/queries";
import { displayNameFor, groupSectionsByRecord } from "../web/features/history/helpers";

const toHistorySection = (section: TaskSectionRow) => ({
  sectionName: section.sectionName,
  value: section.value,
  sectionType: section.sectionType,
  isRequired: section.isRequired === 1,
  startedAt: section.startedAt?.getTime() ?? null,
});

export const historyStream: Stream.Stream<Message> = storeStream(
  Message.StoreUnavailable(),
  ({ store, queries }, emit) => [
    store.subscribe(queries.archivedSessions, (rows) =>
      emit(
        Message.GotHistory({
          history: rows.map((row) => ({
            ...row,
            displayName: displayNameFor(row.sessionName, row.templateName),
          })),
        }),
      ),
    ),
  ],
);

export const historyDetailStream = (sessionId: string): Stream.Stream<Message> =>
  storeStream(Message.StoreUnavailable(), ({ store, queries }, emit) => [
    store.subscribe(queries.archiveRows(sessionId), ({ session, records, sections }) => {
      if (session === null || session.endedAt === null) {
        emit(Message.GotHistoryDetail({ detail: null }));
        return;
      }
      const sectionsByRecord = groupSectionsByRecord(sections);
      // Records arrive ordered by task number.
      const tasks = records.map((record) => ({
        id: record.id,
        taskId: record.taskId,
        startedAt: record.startedAt?.getTime() ?? null,
        endedAt: record.endedAt?.getTime() ?? null,
        sections: (sectionsByRecord.get(record.id) ?? []).map(toHistorySection),
      }));
      emit(
        Message.GotHistoryDetail({
          detail: {
            id: session.id,
            sessionName: session.sessionName,
            templateName: session.templateName,
            startedAt: session.startedAt.getTime(),
            endedAt: session.endedAt.getTime(),
            taskCount: tasks.length,
            tasks,
          },
        }),
      );
    }),
  ]);
