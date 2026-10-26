import { Array } from "effect";

import type { ArchiveRecord } from "../../../domain/archive";

type TaskRow = Readonly<{ orderIndex: number; taskType: string; endDate: Date | null }>;
type FieldRow = Readonly<{
  name: string;
  value: string;
  kind: string;
  isRequired: number;
  startDate: Date | null;
}>;

/**
 * One finished live task as it is archived: its start is the earliest first
 * answer (null if untouched), answers keep question order. Shared by ending a
 * session and by a backup that includes a session still open.
 */
export const archiveRecord = (
  task: TaskRow,
  fieldRows: ReadonlyArray<FieldRow>,
): typeof ArchiveRecord.Type => {
  // The earliest first-answer time, or null when no question was touched.
  const startedAt = Array.reduce(fieldRows, null as Date | null, (earliest, r) =>
    r.startDate !== null && (earliest === null || r.startDate.getTime() < earliest.getTime())
      ? r.startDate
      : earliest,
  );
  return {
    taskIdNumber: task.orderIndex,
    taskType: task.taskType,
    startedAt,
    endedAt: task.endDate,
    sections: Array.map(fieldRows, (r) => ({
      sectionName: r.name,
      value: r.value,
      sectionType: r.kind,
      isRequired: r.isRequired === 1,
      startedAt: r.startDate,
    })),
  };
};
