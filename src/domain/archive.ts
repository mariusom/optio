import { Array, Schema } from "effect";

// Store-free: the backup file format and the schema both use this shape.

/** One finished task as archived into history (session end and backup restore). */
export const ArchiveRecord = Schema.Struct({
  taskIdNumber: Schema.Finite,
  taskType: Schema.String,
  startedAt: Schema.Union([Schema.Null, Schema.DateFromMillis]),
  endedAt: Schema.Union([Schema.Null, Schema.DateFromMillis]),
  sections: Schema.Array(
    Schema.Struct({
      sectionName: Schema.String,
      value: Schema.String,
      sectionType: Schema.String,
      isRequired: Schema.Boolean,
      startedAt: Schema.Union([Schema.Null, Schema.DateFromMillis]),
    }),
  ),
});

/** The first record for each task number (a backup may repeat one). */
export const uniqueTasks = <R extends { readonly taskIdNumber: number }>(
  records: ReadonlyArray<R>,
): ReadonlyArray<R> => Array.dedupeWith(records, (a, b) => a.taskIdNumber === b.taskIdNumber);
