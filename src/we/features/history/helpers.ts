// Pure helpers for History slice — tested in isolation

import { formatCsvDate } from "../../format";

/** Display name mirrors Session.displayName: custom sessionName or templateName */
export const displayNameFor = (sessionName: string, templateName: string): string =>
  sessionName !== "" ? sessionName : templateName;

/** Filename-safe: spaces → underscores (spec: <name spaces→underscores>) */
export const filenameSafe = (name: string): string => name.replace(/ /g, "_");

export const csvEscaped = (value: string): string => {
  if (value === "") return "";
  const needsQuoting = /[, \r\n\t"]/.test(value);
  if (!needsQuoting) return value;
  const doubled = value.replace(/"/g, '""');
  return `"${doubled}"`;
};

export const formatFilenameDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${MM}-${dd}_${HH}-${mm}-${ss}`;
};

export type ArchiveSection = { sectionName: string; value: string };
export type ArchiveTask = {
  taskId: number;
  startedAt: Date | null;
  endedAt: Date | null;
  sections: ReadonlyArray<ArchiveSection>;
};

/** Builds archive CSV string per spec Appendix B */
export const buildArchiveCsv = (records: ReadonlyArray<ArchiveTask>): string => {
  // Union of section names sorted alphabetical
  const namesSet = new Set<string>();
  for (const r of records) for (const s of r.sections) namesSet.add(s.sectionName);
  const sortedNames = [...namesSet].sort((a, b) => a.localeCompare(b));

  const header = ["id", ...sortedNames, "startTime", "endTime"];

  const sortedTasks = [...records].sort((a, b) => a.taskId - b.taskId);

  const rows = sortedTasks.map((task) => {
    const valueByName = new Map<string, string>();
    for (const s of task.sections) valueByName.set(s.sectionName, s.value);
    const cells: string[] = [];
    cells.push(csvEscaped(String(task.taskId)));
    for (const name of sortedNames) {
      const v = valueByName.get(name) ?? "";
      cells.push(csvEscaped(v));
    }
    const startStr = task.startedAt ? formatCsvDate(task.startedAt) : "";
    const endStr = task.endedAt ? formatCsvDate(task.endedAt) : "";
    cells.push(csvEscaped(startStr));
    cells.push(csvEscaped(endStr));
    return cells.join(",");
  });

  const heading = header.map(csvEscaped).join(",");
  if (rows.length === 0) return heading;
  return `${heading}\n${rows.join("\n")}`;
};

export const filenameForArchive = (displayName: string, now: Date = new Date()): string =>
  `WatchfulEye_${filenameSafe(displayName)}_${formatFilenameDate(now)}.csv`;
