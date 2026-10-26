import { Array, Clock, DateTime, Duration, Effect, Option, pipe, Schema } from "effect";
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
import { confirmedOnDisk } from "../../storeDurability";
import { archiveRecord } from "../session/archiveRecord";
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
  return Array.map(store.query(tables.templates.select().orderBy("name", "asc")), (t) => ({
    id: t.id,
    name: t.name,
    fields: [...fieldRowsToDefs(fields.get(t.id) ?? [])],
  }));
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
  return Array.flatMap(
    store.query(tables.sessions.select().orderBy("startedAt", "asc")),
    ({ endedAt, ...session }) =>
      endedAt === null
        ? []
        : [
            {
              ...session,
              endedAt,
              records: Array.map(records.get(session.id) ?? [], (record) => ({
                taskIdNumber: record.taskId,
                taskType: record.taskType,
                startedAt: record.startedAt,
                endedAt: record.endedAt,
                sections: Array.map(sections.get(record.id) ?? [], (section) => ({
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

/**
 * The open session as if it ended at `endedAt`, with every recorded task.
 * Only used while saving has stalled: then the open work may never reach disk,
 * and a backup is the only way to keep it.
 */
const openSessions = ({ store, tables }: Access, endedAt: Date): BackupFile["sessions"] =>
  pipe(
    store.query(tables.sessions.select()),
    Array.filter((session) => session.endedAt === null),
    Array.flatMap(({ endedAt: _open, ...session }) => {
      const records = pipe(
        store.query(
          tables.sessionTasks
            .select()
            .where({ sessionId: session.id })
            .orderBy("orderIndex", "asc"),
        ),
        Array.filter((task) => task.endDate !== null),
        Array.map((task) =>
          archiveRecord(
            task,
            store.query(
              tables.sessionTaskFields
                .select()
                .where({ taskId: task.id })
                .orderBy("sortOrder", "asc"),
            ),
          ),
        ),
      );
      return records.length === 0 ? [] : [{ ...session, endedAt, records }];
    }),
  );

export const DownloadBackup = Command.define("DownloadBackup", {
  args: { includeOpenSession: Schema.Boolean },
  messages: [Message.BackupDownloaded, Message.FailedBackup],
  execute: ({ includeOpenSession }) =>
    withStore((access) =>
      Effect.gen(function* () {
        const exportedAt = yield* DateTime.nowAsDate;
        const file: BackupFile = {
          format: "optio-backup",
          version: 1,
          exportedAt,
          templates: backupTemplates(access),
          sessions: [
            ...backupSessions(access),
            ...(includeOpenSession ? openSessions(access, exportedAt) : []),
          ],
        };
        const filename = backupFilename(exportedAt);
        return yield* Effect.try(() =>
          saveTextFile(encodeBackup(file), filename, "application/json"),
        ).pipe(
          Effect.match({
            // Log the thrown value itself, as before; the user sees the backup phrase.
            onFailure: (error) => failed(friendlyFailure("backup", error.cause)),
            onSuccess: () => Message.BackupDownloaded({ filename }),
          }),
        );
      }),
    ).pipe(reportFailure("backup", failed)),
});

/** The chosen file's text, clearing the input so the same file can be chosen again. */
const readChosenFile = (inputId: string) =>
  Effect.suspend((): Effect.Effect<string | null> => {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) return Effect.succeed(null);
    const file = input.files?.[0];
    input.value = "";
    return file === undefined ? Effect.succeed(null) : Effect.promise(() => file.text());
  });

/** Longest wait for a restore to reach disk before reporting it as still saving. */
const saveTimeout = Duration.seconds(60);

const restore = (access: Access, file: BackupFile) =>
  Effect.gen(function* () {
    const { store, tables, events } = access;
    const sessionRows = store.query(tables.sessions.select());
    const plan = planRestore(file, {
      templates: backupTemplates(access),
      sessionIds: new Set(Array.map(sessionRows, (row) => row.id)),
      liveSessionIds: new Set(
        pipe(
          sessionRows,
          Array.filter((row) => row.endedAt === null),
          Array.map((row) => row.id),
        ),
      ),
    });
    const now = yield* DateTime.nowAsDate;
    store.commit(
      events.backupRestored({ now, templates: plan.templates, sessions: plan.sessions }),
    );
    // Only report success once the restore has reached disk: a reload before
    // that (seconds for a large backup) would silently lose it.
    const saved = yield* confirmedOnDisk(store, saveTimeout);
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
