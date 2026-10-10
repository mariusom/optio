import { Clock, Duration, Effect, Option, Schedule, Schema } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { withStore, type StoreAccess } from "../../../livestore/access";
import {
  backupFilename,
  backupProblem,
  decodeBackup,
  encodeBackup,
  planRestore,
  type BackupFile,
} from "../../backup";
import { saveTextFile } from "../../download";
import { friendlyFailure, reportFailure } from "../../errors";
import { fieldRowsToDefs } from "../../fieldRows";

// Download every template and finished session as one JSON file, and restore
// such a file by adding whatever is missing (`v3.BackupRestored`).

const failed = (error: string) => Message.FailedBackup({ error });

type Access = StoreAccess;

const groupBy = <T, K>(rows: ReadonlyArray<T>, key: (row: T) => K): ReadonlyMap<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};

/** Every template with its questions, in name order. */
const backupTemplates = ({ store, tables }: Access): BackupFile["templates"] => {
  const fields = groupBy(
    store.query(tables.templateFields.select().orderBy("sortOrder", "asc")),
    (row) => row.templateId,
  );
  return store
    .query(tables.templates.select().orderBy("name", "asc"))
    .map((t) => ({ id: t.id, name: t.name, fields: [...fieldRowsToDefs(fields.get(t.id) ?? [])] }));
};

/** Every finished session with its archived tasks and answers, oldest first. */
const backupSessions = ({ store, tables }: Access): BackupFile["sessions"] => {
  const sections = groupBy(
    store.query(tables.taskSectionRecords.select().orderBy("position", "asc")),
    (row) => row.taskRecordId,
  );
  const records = groupBy(
    store.query(tables.taskRecords.select().orderBy("taskId", "asc")),
    (row) => row.sessionId,
  );
  return store
    .query(tables.sessions.select().orderBy("startedAt", "asc"))
    .flatMap(({ endedAt, ...session }) =>
      endedAt === null
        ? []
        : [
            {
              ...session,
              endedAt,
              records: (records.get(session.id) ?? []).map((record) => ({
                taskIdNumber: record.taskId,
                taskType: record.taskType,
                startedAt: record.startedAt,
                endedAt: record.endedAt,
                sections: (sections.get(record.id) ?? []).map((section) => ({
                  sectionName: section.sectionName,
                  value: section.value,
                  sectionType: section.sectionType,
                  isRequired: section.isRequired === 1,
                  startedAt: section.startedAt,
                })),
              })),
            },
          ],
    );
};

export const DownloadBackup = Command.define("DownloadBackup", {
  messages: [Message.BackupDownloaded, Message.FailedBackup],
  execute: withStore((access) =>
    Effect.gen(function* () {
      const exportedAt = new Date(yield* Clock.currentTimeMillis);
      const file: BackupFile = {
        format: "optio-backup",
        version: 1,
        exportedAt,
        templates: backupTemplates(access),
        sessions: backupSessions(access),
      };
      const filename = backupFilename(exportedAt);
      try {
        saveTextFile(encodeBackup(file), filename, "application/json");
      } catch (error) {
        return failed(friendlyFailure("backup", error));
      }
      return Message.BackupDownloaded({ filename });
    }),
  ).pipe(reportFailure("backup", failed)),
});

/** The chosen file's text, clearing the input so the same file can be chosen again. */
const readChosenFile = (inputId: string) =>
  Effect.promise(async () => {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) return null;
    const file = input.files?.[0];
    input.value = "";
    return file === undefined ? null : file.text();
  });

/** Longest wait for a restore to reach disk before reporting it as still saving. */
const saveTimeout = Duration.seconds(60);

/** The global event number of a LiveStore head such as "e12" or "e12.3". */
const headNumber = (head: string): number => Number(/^e(\d+)/.exec(head)?.[1] ?? Number.NaN);

/**
 * True once the leader (which writes to disk) has confirmed every event this
 * session had committed when called; false if that takes longer than the wait.
 * Commit updates `localHead` synchronously; `upstreamHead` follows the leader.
 */
const savedToDisk = (store: Access["store"]) => {
  const target = headNumber(store.syncStatus().localHead);
  return Effect.sync(() => headNumber(store.syncStatus().upstreamHead) >= target).pipe(
    Effect.repeat({ until: (confirmed) => confirmed, schedule: Schedule.spaced("100 millis") }),
    Effect.timeoutOption(saveTimeout),
    Effect.map(Option.isSome),
  );
};

const restore = (access: Access, file: BackupFile) =>
  Effect.gen(function* () {
    const { store, tables, events } = access;
    const plan = planRestore(file, {
      templates: backupTemplates(access),
      sessionIds: new Set(store.query(tables.sessions.select()).map((row) => row.id)),
    });
    const now = new Date(yield* Clock.currentTimeMillis);
    store.commit(
      events.backupRestored({ now, templates: plan.templates, sessions: plan.sessions }),
    );
    // Only report success once the restore has reached disk: a reload before
    // that (seconds for a large backup) would silently lose it.
    const saved = yield* savedToDisk(store);
    return Message.BackupRestored({
      templates: plan.templates.length,
      sessions: plan.sessions.length,
      skipped: plan.skipped,
      saved,
    });
  });

export const RestoreBackup = Command.define("RestoreBackup", {
  args: { inputId: Schema.String },
  messages: [Message.BackupRestored, Message.FailedBackup],
  execute: ({ inputId }) =>
    Effect.gen(function* () {
      const text = yield* readChosenFile(inputId);
      if (text === null) return failed("Choose a backup file to restore.");
      const file = decodeBackup(text);
      if (Option.isNone(file)) return failed("That file isn't an Optio backup.");
      const problem = backupProblem(file.value, yield* Clock.currentTimeMillis);
      if (problem !== null) return failed(problem);
      return yield* withStore((access) => restore(access, file.value));
    }).pipe(reportFailure("restore", failed)),
});
