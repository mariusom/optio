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
  const sortedNames = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const reserved = new Set(["id", "startTime", "endTime"]);
  const used = new Set([...reserved, ...sortedNames]);
  const columns = sortedNames.flatMap((name) =>
    Array.from({ length: counts.get(name)! }, (_, occurrence) => {
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
  const header = ["id", ...columns.map((column) => column.header), "startTime", "endTime"];

  const sortedTasks = [...records].sort((a, b) => a.taskId - b.taskId);

  const rows = sortedTasks.map((task) => {
    const valueByName = new Map<string, string[]>();
    for (const s of task.sections) {
      const values = valueByName.get(s.sectionName) ?? [];
      values.push(s.value);
      valueByName.set(s.sectionName, values);
    }
    const cells: string[] = [];
    cells.push(csvEscaped(String(task.taskId)));
    for (const { name, occurrence } of columns) {
      const v = valueByName.get(name)?.[occurrence] ?? "";
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
  `optio_${filenameSafe(displayName)}_${formatFilenameDate(now)}.csv`;
