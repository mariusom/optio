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
  const starts = fieldRows.flatMap((r) => (r.startDate === null ? [] : [r.startDate.getTime()]));
  return {
    taskIdNumber: task.orderIndex,
    taskType: task.taskType,
    startedAt: starts.length > 0 ? new Date(Math.min(...starts)) : null,
    endedAt: task.endDate,
    sections: fieldRows.map((r) => ({
      sectionName: r.name,
      value: r.value,
      sectionType: r.kind,
      isRequired: r.isRequired === 1,
      startedAt: r.startDate,
    })),
  };
};
