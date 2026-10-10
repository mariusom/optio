import { Option, Schema } from "effect";

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

const pad = (value: number) => String(value).padStart(2, "0");

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "optio-backup-2026-10-10.json", in local time like CSV exports. */
export const backupFilename = (exportedAt: Date): string => {
  return `optio-backup-${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(exportedAt.getDate())}.json`;
};

/** "Restored 2 templates and 5 sessions." with skipped items noted. */
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
    : `${added}; ${plural(counts.skipped, "item")} already here ${counts.skipped === 1 ? "was" : "were"} kept.`;
};

type BackupTemplate = BackupFile["templates"][number];

/** Same name and the same questions in the same order: the same template. */
const templateSignature = (template: Pick<BackupTemplate, "name" | "fields">): string =>
  JSON.stringify([
    template.name,
    template.fields
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((f) => [f.name, f.kind, f.isRequired, f.defaultValue, f.options, f.exclusiveOptions]),
  ]);

/**
 * What a restore adds. A backup template is already here when its ID exists
 * or an existing template has the same name and questions (each browser seeds
 * its own copies of the samples); its sessions then point at that template.
 * Like the store's own guard, a template whose question IDs are taken, a
 * session whose ID exists, and any ID repeated within the file are skipped,
 * so the summary counts exactly what the restore adds.
 */
export const planRestore = (
  file: BackupFile,
  existing: Readonly<{
    templates: ReadonlyArray<Pick<BackupTemplate, "id" | "name" | "fields">>;
    sessionIds: ReadonlySet<string>;
  }>,
) => {
  const templateIds = new Set(existing.templates.map((t) => t.id));
  const fieldIds = new Set(existing.templates.flatMap((t) => t.fields.map((f) => f.id)));
  const bySignature = new Map(existing.templates.map((t) => [templateSignature(t), t.id]));
  const remap = new Map<string, string>();
  const templates = file.templates.filter((template) => {
    if (templateIds.has(template.id) || remap.has(template.id)) return false;
    const match = bySignature.get(templateSignature(template));
    if (match !== undefined) {
      remap.set(template.id, match);
      return false;
    }
    const ids = template.fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => fieldIds.has(id))) return false;
    templateIds.add(template.id);
    for (const id of ids) fieldIds.add(id);
    return true;
  });
  const sessionIds = new Set(existing.sessionIds);
  const sessions = file.sessions.flatMap((session) => {
    if (sessionIds.has(session.id)) return [];
    sessionIds.add(session.id);
    const templateId =
      session.templateId === null ? null : (remap.get(session.templateId) ?? session.templateId);
    return [{ ...session, templateId, records: uniqueTasks(session.records) }];
  });
  const skipped = file.templates.length - templates.length + file.sessions.length - sessions.length;
  return { templates, sessions, skipped };
};
