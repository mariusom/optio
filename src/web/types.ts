import { Schema } from "effect";

// Shared model payload schemas (used by Messages and the shell Model)

export const TemplateSummary = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  fieldCount: Schema.Number,
  requiredCount: Schema.Number,
});
export type TemplateSummary = typeof TemplateSummary.Type;
