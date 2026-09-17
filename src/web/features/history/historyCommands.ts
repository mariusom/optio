import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { friendlyFailure } from "../../errors";
import { isBooleanTrue } from "../../fields";
import { getStore } from "../../../livestore/client";
import { events, tables } from "../../../livestore/schema";
import { buildArchiveCsv, filenameForArchive, type ArchiveTask } from "./helpers";

// Safari-compatible Blob URL + a[download]. Non-browser callers still get the filename.
const downloadCsv = (csv: string, filename: string) => {
  if (typeof document !== "undefined" && typeof URL !== "undefined") {
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } catch (error) {
      return Message.FailedCsvExport({ error: friendlyFailure("export", error) });
    }
  }
  return Message.CsvExported({ filename });
};

// DeleteHistorySession → sessionDeleted
export const DeleteHistorySession = Command.define("DeleteHistorySession", {
  args: { id: S.String },
  messages: [Message.HistoryDeleted, Message.FailedCsvExport],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      store.commit(events.sessionDeleted({ id }));
      return Message.HistoryDeleted();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedCsvExport({ error: friendlyFailure("delete", cause) })),
      ),
    ),
});

// RenameHistorySession → sessionRenamed
export const RenameHistorySession = Command.define("RenameHistorySession", {
  args: { id: S.String, sessionName: S.String },
  messages: [Message.HistoryNameUpdated, Message.FailedCsvExport],
  execute: ({ id, sessionName }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      store.commit(events.sessionRenamed({ id, sessionName }));
      return Message.HistoryNameUpdated();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedCsvExport({ error: friendlyFailure("save", cause) })),
      ),
    ),
});

// ExportSessionCsv — archive format only (history is archive)
export const ExportSessionCsv = Command.define("ExportSessionCsv", {
  args: { sessionId: S.String, spreadsheetSafe: S.optionalKey(S.Boolean) },
  messages: [Message.CsvExported, Message.FailedCsvExport],
  execute: ({ sessionId, spreadsheetSafe = false }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);

      // Fetch session for displayName + filename
      const sessions = store.query(
        tables.sessions.select().where({ id: sessionId }),
      ) as ReadonlyArray<{
        id: string;
        sessionName: string;
        templateName: string;
        startedAt: Date | number;
        endedAt: Date | number | null;
      }>;
      const session = sessions[0];
      if (!session) return Message.FailedCsvExport({ error: "That session is no longer here." });

      const displayName = session.sessionName !== "" ? session.sessionName : session.templateName;

      // Fetch taskRecords + section records for archive CSV
      const taskRows = store.query(
        tables.taskRecords.select().where({ sessionId }).orderBy("taskId", "asc"),
      ) as ReadonlyArray<{
        id: string;
        taskId: number;
        startedAt: Date | number | null;
        endedAt: Date | number | null;
      }>;

      if (taskRows.length === 0) {
        return Message.FailedCsvExport({ error: "There are no tasks in this session to export." });
      }

      const allSectionRows = store.query(tables.taskSectionRecords.select()) as ReadonlyArray<{
        id: string;
        taskRecordId: string;
        sectionName: string;
        value: string;
        sectionType: string;
        isRequired: number;
        startedAt: Date | number | null;
      }>;

      const sectionsByRecord = new Map<string, Array<(typeof allSectionRows)[number]>>();
      for (const section of allSectionRows) {
        const sections = sectionsByRecord.get(section.taskRecordId) ?? [];
        sections.push(section);
        sectionsByRecord.set(section.taskRecordId, sections);
      }

      const records: ReadonlyArray<ArchiveTask> = taskRows.map((tr) => {
        const secs = sectionsByRecord.get(tr.id) ?? [];
        const startedAt =
          tr.startedAt === null || tr.startedAt === undefined
            ? null
            : tr.startedAt instanceof Date
              ? tr.startedAt
              : new Date(Number(tr.startedAt));
        const endedAt =
          tr.endedAt === null || tr.endedAt === undefined
            ? null
            : tr.endedAt instanceof Date
              ? tr.endedAt
              : new Date(Number(tr.endedAt));
        return {
          taskId: Number(tr.taskId),
          startedAt,
          endedAt,
          sections: secs.map((s) => ({
            sectionName: s.sectionName,
            // Keep unanswered distinct from an explicit No.
            value:
              s.sectionType === "boolean" && s.value !== ""
                ? String(isBooleanTrue(s.value))
                : s.value,
          })),
        };
      });

      // Use helper to build CSV
      const csv = buildArchiveCsv(records, spreadsheetSafe);

      const filename = filenameForArchive(displayName, new Date());
      return downloadCsv(csv, filename);
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedCsvExport({ error: friendlyFailure("export", cause) })),
      ),
    ),
});
