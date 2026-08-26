import { Schema as S } from "effect";

// Shared model payload schemas (used by Messages and the shell Model)

export const TemplateSummary = S.Struct({
  id: S.String,
  name: S.String,
  isDefault: S.Boolean,
  createdAt: S.Number,
  updatedAt: S.Number,
  fieldCount: S.Number,
  requiredCount: S.Number,
});
export type TemplateSummary = typeof TemplateSummary.Type;
