import type { FieldDef, FieldKind } from "../../../livestore/schema";
import { hasOptions, supportsRequired } from "../../fields";

// ── Types mirroring Model.editor ──────────────────────────────────────────

export type FieldDraft = {
  readonly id: string;
  readonly name: string;
  readonly kind: FieldKind;
  readonly isRequired: boolean;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly options: ReadonlyArray<string>;
  readonly exclusiveOptions: ReadonlyArray<string>;
  readonly newOptionText: string;
};

export type EditorState = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly fields: ReadonlyArray<FieldDef>;
  readonly original: {
    readonly name: string;
    readonly isDefault: boolean;
    readonly fields: ReadonlyArray<FieldDef>;
  };
  readonly isSaving: boolean;
  readonly showAddField: boolean;
  readonly editingFieldId: string | null;
  readonly draft: FieldDraft | null;
  readonly pendingDiscard: boolean;
};

// ── Validation ─────────────────────────────────────────────────────────────

export const isTemplateValid = (editor: { readonly name: string }): boolean =>
  editor.name.trim().length > 0;

export const isDraftValid = (draft: FieldDraft): boolean => {
  if (draft.name.trim().length === 0) return false;
  if (hasOptions(draft.kind) && draft.options.length === 0) return false;
  return true;
};

// ── hasChanges — deep diff of id,name,kind,isRequired,options,exclusive,defaultValue + name/default ──

const arrayEqual = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const hasChanges = (editor: EditorState): boolean => {
  if (editor.name !== editor.original.name) return true;
  if (editor.isDefault !== editor.original.isDefault) return true;
  if (editor.fields.length !== editor.original.fields.length) return true;
  for (let index = 0; index < editor.fields.length; index += 1) {
    const current = editor.fields[index] as FieldDef;
    const original = editor.original.fields[index] as FieldDef;
    if (current.id !== original.id) return true;
    if (current.name !== original.name) return true;
    if (current.kind !== original.kind) return true;
    if (current.isRequired !== original.isRequired) return true;
    if (current.defaultValue !== original.defaultValue) return true;
    if (current.sortOrder !== original.sortOrder) return true;
    if (!arrayEqual(current.options, original.options)) return true;
    if (!arrayEqual(current.exclusiveOptions, original.exclusiveOptions)) return true;
  }
  return false;
};

// ── Sort order helpers — dense renumber after moves/deletes ───────────────

export const renumberFields = (fields: ReadonlyArray<FieldDef>): ReadonlyArray<FieldDef> =>
  fields.map((field, index) => ({ ...field, sortOrder: index }));

export const moveField = (
  fields: ReadonlyArray<FieldDef>,
  id: string,
  direction: -1 | 1,
): ReadonlyArray<FieldDef> => {
  const index = fields.findIndex((field) => field.id === id);
  if (index === -1) return fields;
  const target = index + direction;
  if (target < 0 || target >= fields.length) return fields;
  const next = [...fields];
  const temporary = next[index] as FieldDef;
  next[index] = next[target] as FieldDef;
  next[target] = temporary;
  return renumberFields(next);
};

export const deleteField = (fields: ReadonlyArray<FieldDef>, id: string): ReadonlyArray<FieldDef> =>
  renumberFields(fields.filter((field) => field.id !== id));

// ── Draft → FieldDef conversion with normalization ──────────────────────────

export const draftToFieldDef = (draft: FieldDraft): FieldDef => {
  const kind: FieldKind = draft.kind;
  const isRequired = supportsRequired(kind) ? draft.isRequired : false;
  const hasOpts = hasOptions(kind);
  const options = hasOpts ? [...draft.options] : [];
  const exclusiveOptions =
    kind === "checkbox"
      ? [...draft.exclusiveOptions].filter((option) => options.includes(option))
      : [];
  let defaultValue = draft.defaultValue;
  if (kind === "boolean") {
    defaultValue = defaultValue === "true" ? "true" : "false";
  }
  return {
    id: draft.id,
    name: draft.name.trim(),
    kind,
    isRequired,
    defaultValue,
    sortOrder: draft.sortOrder,
    options,
    exclusiveOptions,
  };
};

export const makeEmptyDraft = (sortOrder: number): FieldDraft => ({
  id: crypto.randomUUID(),
  name: "",
  kind: "textInput",
  isRequired: false,
  defaultValue: "",
  sortOrder,
  options: [],
  exclusiveOptions: [],
  newOptionText: "",
});

export const draftFromField = (field: FieldDef): FieldDraft => ({
  id: field.id,
  name: field.name,
  kind: field.kind,
  isRequired: field.isRequired,
  defaultValue: field.defaultValue,
  sortOrder: field.sortOrder,
  options: [...field.options],
  exclusiveOptions: [...field.exclusiveOptions],
  newOptionText: "",
});

// ── Option helpers for drafts ───────────────────────────────────────────────

export const addOptionToDraft = (draft: FieldDraft): FieldDraft => {
  const trimmed = draft.newOptionText.trim();
  if (trimmed === "") return draft;
  if (draft.options.includes(trimmed)) return { ...draft, newOptionText: "" };
  return { ...draft, options: [...draft.options, trimmed], newOptionText: "" };
};

export const deleteOptionFromDraft = (draft: FieldDraft, index: number): FieldDraft => {
  const options = draft.options.filter((_, candidate) => candidate !== index);
  const removed = draft.options[index];
  const exclusiveOptions =
    removed === undefined
      ? draft.exclusiveOptions
      : draft.exclusiveOptions.filter((option) => option !== removed);
  return { ...draft, options, exclusiveOptions };
};

export const toggleExclusiveOption = (draft: FieldDraft, index: number): FieldDraft => {
  const option = draft.options[index];
  if (option === undefined) return draft;
  if (draft.kind !== "checkbox") return draft;
  const isExclusive = draft.exclusiveOptions.includes(option);
  const exclusiveOptions = isExclusive
    ? draft.exclusiveOptions.filter((candidate) => candidate !== option)
    : [...draft.exclusiveOptions, option];
  return { ...draft, exclusiveOptions };
};
