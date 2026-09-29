import { Schema } from "effect";

// Store-free domain schemas: the model, messages and agent boundary import these
// without pulling LiveStore into the initial module graph.

/** Supported template answer types. */
export const FieldKind = Schema.Literals([
  "radio",
  "checkbox",
  "textInput",
  "textArea",
  "boolean",
  "number",
  "counter",
  "rating",
]);
export type FieldKind = typeof FieldKind.Type;

export const FieldDef = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: FieldKind,
  isRequired: Schema.Boolean,
  defaultValue: Schema.String,
  sortOrder: Schema.Number,
  options: Schema.Array(Schema.String),
  exclusiveOptions: Schema.Array(Schema.String),
});
export type FieldDef = typeof FieldDef.Type;
