// Pure helpers for History slice — tested in isolation

import { Array, DateTime, Order, pipe, String } from "effect";

import { isBooleanTrue } from "../../fields";
import { formatCsvDate, formatDurationShort } from "../../format";

const padTwoDigits = (value: number): string =>
  pipe(globalThis.String(value), String.padStart(2, "0"));

/** Display name mirrors Session.displayName: custom sessionName or templateName */
export const displayNameFor = (sessionName: string, templateName: string): string =>
  sessionName !== "" ? sessionName : templateName;

/** Groups archived answers by task record, keeping their (question) order. */
export const groupSectionsByRecord = <Section extends { readonly taskRecordId: string }>(
  sections: ReadonlyArray<Section>,
): ReadonlyMap<string, ReadonlyArray<Section>> => {
  const byRecord = new Map<string, Array<Section>>();
  for (const section of sections) {
    const group = byRecord.get(section.taskRecordId);
    if (group === undefined) byRecord.set(section.taskRecordId, [section]);
    else group.push(section);
  }
  return byRecord;
};

/** Keep exported names readable by replacing spaces with underscores. */
export const filenameSafe = (name: string): string => pipe(name, String.replace(/ /g, "_"));

export const csvEscaped = (value: string, spreadsheetSafe = false): string => {
  if (value === "") return "";
  // CSV quoting alone does not prevent formulas. Prefix risky cells as text
  // only in the explicitly requested spreadsheet format; raw exports stay exact.
  // Spreadsheet re-saving can remove this protection (see docs/development.md).
  if (spreadsheetSafe && (/^[\s\p{Cc}]*[=+\-@＝＋－＠]/u.test(value) || /^[\t\r\n]/.test(value))) {
    return `"'${pipe(value, String.replace(/"/g, '""'))}"`;
  }
  const needsQuoting = /[, \r\n\t"]/.test(value);
  if (!needsQuoting) return value;
  const doubled = pipe(value, String.replace(/"/g, '""'));
  return `"${doubled}"`;
};

export const formatFilenameDate = (date: Date): string => {
  const yyyy = pipe(globalThis.String(date.getFullYear()), String.padStart(4, "0"));
  const MM = padTwoDigits(date.getMonth() + 1);
  const dd = padTwoDigits(date.getDate());
  const HH = padTwoDigits(date.getHours());
  const mm = padTwoDigits(date.getMinutes());
  const ss = padTwoDigits(date.getSeconds());
  return `${yyyy}-${MM}-${dd}_${HH}-${mm}-${ss}`;
};

export type ArchiveSection = { sectionName: string; value: string };
export type ArchiveTask = {
  taskId: number;
  startedAt: Date | null;
  endedAt: Date | null;
  sections: ReadonlyArray<ArchiveSection>;
};

/** Archive columns are ordered by question name, with distinct duplicate headings. */
export const buildArchiveCsv = (
  records: ReadonlyArray<ArchiveTask>,
  spreadsheetSafe = false,
): string => {
  // Align same-name fields across tasks by occurrence in section order.
  // Keep enough columns for the largest number of occurrences in any task.
  const counts = new Map<string, number>();
  for (const task of records) {
    const occurrences = new Map<string, number>();
    for (const { sectionName } of task.sections) {
      const count = (occurrences.get(sectionName) ?? 0) + 1;
      occurrences.set(sectionName, count);
      counts.set(sectionName, Math.max(counts.get(sectionName) ?? 0, count));
    }
  }
  const sortedNames = Array.sort(
    [...counts.keys()],
    Order.make<string>((a, b) => pipe(a, String.localeCompare(b))),
  );
  const reserved = new Set(["id", "startTime", "endTime"]);
  const used = new Set([...reserved, ...sortedNames]);
  const columns = Array.flatMap(sortedNames, (name) =>
    Array.makeBy(counts.get(name)!, (occurrence) => {
      let header = name;
      if (occurrence > 0 || reserved.has(name)) {
        let suffix = occurrence + 1;
        do {
          header = `${name} (${suffix++})`;
        } while (used.has(header));
        used.add(header);
      }
      return { name, occurrence, header };
    }),
  );
  const header = ["id", ...Array.map(columns, (column) => column.header), "startTime", "endTime"];

  const sortedTasks = Array.sort(
    records,
    Order.mapInput(Order.Number, (task: ArchiveTask) => task.taskId),
  );

  const rows = Array.map(sortedTasks, (task) => {
    const valueByName = new Map<string, string[]>();
    for (const s of task.sections) {
      const values = valueByName.get(s.sectionName) ?? [];
      values.push(s.value);
      valueByName.set(s.sectionName, values);
    }
    const cells: string[] = [];
    cells.push(csvEscaped(globalThis.String(task.taskId)));
    for (const { name, occurrence } of columns) {
      const v = valueByName.get(name)?.[occurrence] ?? "";
      cells.push(csvEscaped(v, spreadsheetSafe));
    }
    const startStr = task.startedAt !== null ? formatCsvDate(task.startedAt) : "";
    const endStr = task.endedAt !== null ? formatCsvDate(task.endedAt) : "";
    cells.push(csvEscaped(startStr));
    cells.push(csvEscaped(endStr));
    return Array.join(cells, ",");
  });

  const heading = pipe(
    header,
    Array.map((value) => csvEscaped(value, spreadsheetSafe)),
    Array.join(","),
  );
  if (rows.length === 0) return heading;
  return `${heading}\n${Array.join(rows, "\n")}`;
};

export const filenameForArchive = (displayName: string, now: Date): string =>
  `optio_${filenameSafe(displayName)}_${formatFilenameDate(now)}.csv`;

// ── Display helpers ───────────────────────────────────────────────────────

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** A Date for stored epoch millis; its getters still read the viewer's local time. */
const dateAt = (epochMs: number): Date => DateTime.toDateUtc(DateTime.makeUnsafe(epochMs));

/** Local midnight of the epoch's calendar day (same as `new Date(y, m, d)`). */
const startOfDay = (epochMs: number): number => dateAt(epochMs).setHours(0, 0, 0, 0);

/** "Today" / "Yesterday" / "Mon, Feb 3" — section header for a day of sessions. */
export const dayGroupLabel = (epochMs: number, now: number): string => {
  const days = Math.round((startOfDay(now) - startOfDay(epochMs)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return DateTime.formatIntl(DateTime.makeUnsafe(epochMs), dayFormatter);
};

const fullDayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** "Tue, Sep 8, 2026" — the day a session was recorded; fits a phone row value. */
export const formatDay = (epochMs: number): string =>
  DateTime.formatIntl(DateTime.makeUnsafe(epochMs), fullDayFormatter);

/** Groups already date-sorted sessions into consecutive runs of the same day. */
export const groupByDay = <T extends { readonly startedAt: number }>(
  sessions: ReadonlyArray<T>,
  now: number,
): ReadonlyArray<{ readonly label: string; readonly sessions: ReadonlyArray<T> }> => {
  const groups: Array<{ label: string; sessions: Array<T> }> = [];
  for (const session of sessions) {
    const label = dayGroupLabel(session.startedAt, now);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.label === label) last.sessions.push(session);
    else groups.push({ label, sessions: [session] });
  }
  return groups;
};

/** A recorded answer in plain language: "Yes"/"No", "A, B", or an em dash. */
export const formatAnswer = (sectionType: string, value: string): string => {
  if (String.trim(value) === "") return "—";
  if (sectionType === "boolean") return isBooleanTrue(value) ? "Yes" : "No";
  if (sectionType === "checkbox") {
    const chosen = pipe(
      value,
      String.split(","),
      Array.map(String.trim),
      Array.filter((part) => part !== ""),
    );
    return chosen.length === 0 ? "—" : Array.join(chosen, ", ");
  }
  return value;
};

/** "12 tasks" / "1 task". */
export const taskCountLabel = (count: number): string => `${count} task${count === 1 ? "" : "s"}`;

/** "3 sessions · 1h 12m" — a day's session count and total recorded time. */
export const daySummaryLabel = (
  sessions: ReadonlyArray<{ readonly startedAt: number; readonly endedAt: number }>,
): string => {
  const totalMs = Array.reduce(
    sessions,
    0,
    (sum, session) => sum + Math.max(0, session.endedAt - session.startedAt),
  );
  const count = `${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
  return `${count} · ${formatDurationShort(totalMs)}`;
};

/**
 * End time for session detail: "4:12 PM", or with the day ("12:02 AM, Sun, Oct
 * 11, 2026") when the session ended on a later calendar day than it started.
 */
export const formatEndTime = (
  startedAt: number,
  endedAt: number,
  formatTime: (ms: number) => string,
): string =>
  dateAt(startedAt).toDateString() === dateAt(endedAt).toDateString()
    ? formatTime(endedAt)
    : `${formatTime(endedAt)}, ${formatDay(endedAt)}`;
