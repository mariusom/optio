import { Array, Option, Order, Schema, String, pipe } from "effect";

import { ArchiveRecord, uniqueTasks } from "../domain/archive";
import { FieldDef } from "../domain/fields";

// The backup file: every template and every finished session, as JSON.
// Restoring adds only what is missing (see `v3.BackupRestored`).

const BackupFileSchema = Schema.Struct({
  format: Schema.Literal("optio-backup"),
  version: Schema.Literal(1),
  exportedAt: Schema.DateFromMillis,
  templates: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String, fields: Schema.Array(FieldDef) }),
  ),
  sessions: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      templateId: Schema.NullOr(Schema.String),
      templateName: Schema.String,
      sessionName: Schema.String,
      startedAt: Schema.DateFromMillis,
      endedAt: Schema.DateFromMillis,
      records: Schema.Array(ArchiveRecord),
    }),
  ),
});
export type BackupFile = typeof BackupFileSchema.Type;

/** Pretty-printed so the file stays readable and diffable. */
export const encodeBackup = (file: BackupFile): string =>
  // @effect-diagnostics-next-line schemaSync:off -- callers need a plain string; a decoded BackupFile always encodes
  `${JSON.stringify(Schema.encodeSync(BackupFileSchema)(file), null, 2)}\n`;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The decoded backup, or none when the text is not an Optio backup. */
export const decodeBackup = (text: string): Option.Option<BackupFile> =>
  Schema.decodeUnknownOption(BackupFileSchema)(parseJson(text));

const pad = (value: number) => pipe(globalThis.String(value), String.padStart(2, "0"));

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "optio-backup-2026-10-10.json", in local time like CSV exports. */
export const backupFilename = (exportedAt: Date): string =>
  `optio-backup-${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}.json`;

/**
 * "Restored 2 templates and 5 sessions." Skipped items are either already
 * here or repeated within the file, so the note names both.
 */
export const restoreSummary = (counts: {
  readonly templates: number;
  readonly sessions: number;
  readonly skipped: number;
}): string => {
  const added =
    counts.templates + counts.sessions === 0
      ? "Nothing new to restore"
      : `Restored ${plural(counts.templates, "template")} and ${plural(counts.sessions, "session")}`;
  return counts.skipped === 0
    ? `${added}.`
    : `${added}; skipped ${plural(counts.skipped, "item")} already here or repeated in the file.`;
};

type BackupTemplate = BackupFile["templates"][number];

/** Same name and the same questions in the same order: the same template. */
const templateSignature = (template: Pick<BackupTemplate, "name" | "fields">): string =>
  JSON.stringify([
    template.name,
    Array.map(
      Array.sort(
        template.fields,
        Order.mapInput(Order.Number, (f: FieldDef) => f.sortOrder),
      ),
      (f) => [f.name, f.kind, f.isRequired, f.defaultValue, f.options, f.exclusiveOptions],
    ),
  ]);

/**
 * What a restore adds. A backup template is already here when its ID exists
 * or an existing template has the same name and questions (each browser seeds
 * its own copies of the samples); its sessions then point at that template.
 * Like the store's own guard, a template whose question IDs are taken, a
 * session whose ID exists, and any ID repeated within the file are skipped,
 * so the summary counts exactly what the restore adds. A finished session whose
 * ID is still a live (unfinished) session here comes back as a separate copy
 * ("<id>-restored"): that happens when a crash stopped saving after the backup
 * was taken, and the backup is then the only complete record.
 */
export const planRestore = (
  file: BackupFile,
  existing: Readonly<{
    templates: ReadonlyArray<Pick<BackupTemplate, "id" | "name" | "fields">>;
    sessionIds: ReadonlySet<string>;
    liveSessionIds?: ReadonlySet<string>;
  }>,
) => {
  const templateIds = new Set(Array.map(existing.templates, (t) => t.id));
  const fieldIds = new Set(
    Array.flatMap(existing.templates, (t) => Array.map(t.fields, (f) => f.id)),
  );
  const bySignature = new Map(
    Array.map(existing.templates, (t) => [templateSignature(t), t.id] as const),
  );
  const remap = new Map<string, string>();
  const templates = Array.filter(file.templates, (template) => {
    if (templateIds.has(template.id) || remap.has(template.id)) return false;
    const match = bySignature.get(templateSignature(template));
    if (match !== undefined) {
      remap.set(template.id, match);
      return false;
    }
    const ids = Array.map(template.fields, (f) => f.id);
    if (new Set(ids).size !== ids.length || Array.some(ids, (id) => fieldIds.has(id))) return false;
    templateIds.add(template.id);
    for (const id of ids) fieldIds.add(id);
    return true;
  });
  const sessionIds = new Set(existing.sessionIds);
  const sessions = Array.flatMap(file.sessions, (session) => {
    const id =
      existing.liveSessionIds?.has(session.id) === true ? `${session.id}-restored` : session.id;
    if (sessionIds.has(id)) return [];
    sessionIds.add(id);
    const templateId =
      session.templateId === null ? null : (remap.get(session.templateId) ?? session.templateId);
    return [{ ...session, id, templateId, records: uniqueTasks(session.records) }];
  });
  const skipped = file.templates.length - templates.length + file.sessions.length - sessions.length;
  return { templates, sessions, skipped };
};

const validTime = (date: Date | null, latest: number): boolean =>
  date === null ||
  (Number.isFinite(date.getTime()) && date.getTime() >= 0 && date.getTime() <= latest);

/**
 * Values Optio never writes, which would corrupt the store or show nonsense:
 * fractional or negative question order, task numbers below 1, unnamed
 * templates or questions, times outside 1970 to the export (or after now),
 * and sessions that end before they start. Null when the file can be restored.
 */
export const backupProblem = (file: BackupFile, now: number): string | null => {
  const latest = Math.min(file.exportedAt.getTime(), now + 86_400_000);
  const badTemplate = Array.some(
    file.templates,
    (t) =>
      String.trim(t.name) === "" ||
      Array.some(
        t.fields,
        (f) => String.trim(f.name) === "" || !Number.isSafeInteger(f.sortOrder) || f.sortOrder < 0,
      ),
  );
  const badSession = Array.some(
    file.sessions,
    (s) =>
      String.trim(s.templateName) === "" ||
      !validTime(s.startedAt, latest) ||
      !validTime(s.endedAt, latest) ||
      s.endedAt.getTime() < s.startedAt.getTime() ||
      Array.some(
        s.records,
        (r) =>
          !Number.isSafeInteger(r.taskIdNumber) ||
          r.taskIdNumber < 1 ||
          !validTime(r.startedAt, latest) ||
          !validTime(r.endedAt, latest) ||
          Array.some(r.sections, (section) => !validTime(section.startedAt, latest)),
      ),
  );
  return badTemplate || badSession
    ? "That backup contains values Optio can't use, so nothing was restored."
    : null;
};
