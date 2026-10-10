import { Clock, Effect, Schema } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { friendlyFailure, reportFailure } from "../../errors";
import { isBooleanTrue } from "../../fields";
import { withStore } from "../../../livestore/access";
import {
  buildArchiveCsv,
  displayNameFor,
  filenameForArchive,
  groupSectionsByRecord,
  type ArchiveTask,
} from "./helpers";

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

const toCsvSection = (section: {
  readonly sectionName: string;
  readonly sectionType: string;
  readonly value: string;
}) => ({
  sectionName: section.sectionName,
  // Keep unanswered distinct from an explicit No.
  value:
    section.sectionType === "boolean" && section.value !== ""
      ? String(isBooleanTrue(section.value))
      : section.value,
});

const failedHistoryOp = (error: string) => Message.FailedHistoryOp({ error });
const failedExport = (error: string) => Message.FailedCsvExport({ error });

// DeleteHistorySession → sessionDeleted
export const DeleteHistorySession = Command.define("DeleteHistorySession", {
  args: { id: Schema.String },
  messages: [Message.HistoryDeleted, Message.FailedHistoryOp],
  execute: ({ id }) =>
    withStore(({ store, events }) =>
      Effect.sync(() => {
        store.commit(events.sessionDeleted({ id }));
        return Message.HistoryDeleted();
      }),
    ).pipe(reportFailure("delete", failedHistoryOp)),
});

// RenameHistorySession → sessionRenamed
export const RenameHistorySession = Command.define("RenameHistorySession", {
  args: { id: Schema.String, sessionName: Schema.String },
  messages: [Message.HistoryNameUpdated, Message.FailedHistoryOp],
  execute: ({ id, sessionName }) =>
    withStore(({ store, events }) =>
      Effect.sync(() => {
        store.commit(events.sessionRenamed({ id, sessionName }));
        return Message.HistoryNameUpdated();
      }),
    ).pipe(reportFailure("save", failedHistoryOp)),
});

// ExportSessionCsv — archive format only (history is archive)
export const ExportSessionCsv = Command.define("ExportSessionCsv", {
  args: { sessionId: Schema.String, spreadsheetSafe: Schema.optionalKey(Schema.Boolean) },
  messages: [Message.CsvExported, Message.FailedCsvExport],
  execute: ({ sessionId, spreadsheetSafe = false }) =>
    withStore(({ store, queries }) =>
      Effect.gen(function* () {
        const exportedAt = new Date(yield* Clock.currentTimeMillis);
        // Reads only this session's records and answers, in question order.
        const { session, records, sections } = store.query(queries.archiveRows(sessionId));
        if (session === null) return failedExport("That session is no longer here.");
        if (records.length === 0)
          return failedExport("There are no tasks in this session to export.");

        const sectionsByRecord = groupSectionsByRecord(sections);
        const tasks: ReadonlyArray<ArchiveTask> = records.map((record) => ({
          taskId: record.taskId,
          startedAt: record.startedAt,
          endedAt: record.endedAt,
          sections: (sectionsByRecord.get(record.id) ?? []).map(toCsvSection),
        }));

        return downloadCsv(
          buildArchiveCsv(tasks, spreadsheetSafe),
          filenameForArchive(displayNameFor(session.sessionName, session.templateName), exportedAt),
        );
      }),
    ).pipe(reportFailure("export", failedExport)),
});
