import { Schema } from "effect";

// Shared model payload schemas (used by Messages and the shell Model)

export const TemplateSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  createdAt: Schema.Finite,
  updatedAt: Schema.Finite,
  fieldCount: Schema.Finite,
  requiredCount: Schema.Finite,
});
export type TemplateSummary = typeof TemplateSummary.Type;

/** A template's time report: every finished session's tasks and answers. */
export const TemplateReport = Schema.Struct({
  templateId: Schema.String,
  sessionCount: Schema.Finite,
  totalMs: Schema.Finite,
  tasks: Schema.Array(
    Schema.Struct({
      startedAt: Schema.NullOr(Schema.Finite),
      endedAt: Schema.NullOr(Schema.Finite),
      sections: Schema.Array(
        Schema.Struct({
          sectionName: Schema.String,
          value: Schema.String,
          sectionType: Schema.String,
        }),
      ),
    }),
  ),
});
export type TemplateReport = typeof TemplateReport.Type;
