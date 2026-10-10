import { Schema } from "effect";

// Store-free: the backup file format and the schema both use this shape.

/** One finished task as archived into history (session end and backup restore). */
export const ArchiveRecord = Schema.Struct({
  taskIdNumber: Schema.Number,
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
