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

/**
 * Draft transform for a field-kind change — carries over the options/defaults
 * that stay valid for the new kind, clears what no longer applies.
 */
export const withKindChanged = (draft: FieldDraft, nextKind: FieldKind): FieldDraft => {
  let next = { ...draft, kind: nextKind };
  if (!supportsRequired(nextKind)) next = { ...next, isRequired: false };
  if (!hasOptions(nextKind)) {
    next = { ...next, options: [], exclusiveOptions: [], newOptionText: "" };
  }
  if (nextKind === "boolean") {
    const current = next.defaultValue;
    next = { ...next, defaultValue: current === "true" ? "true" : "false" };
  } else if (next.defaultValue === "true" || next.defaultValue === "false") {
    // Coming from boolean to text types, clear boolean-style default
    next = { ...next, defaultValue: "" };
  }
  if (nextKind === "checkbox" && next.exclusiveOptions.length > 0) {
    next = {
      ...next,
      exclusiveOptions: next.exclusiveOptions.filter((option) => next.options.includes(option)),
    };
  }
  if (nextKind !== "checkbox") next = { ...next, exclusiveOptions: [] };
  return next;
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

/** One field's dirty check: identity + every editable attribute. */
const fieldDiffers = (current: FieldDef, original: FieldDef): boolean =>
  current.id !== original.id ||
  current.name !== original.name ||
  current.kind !== original.kind ||
  current.isRequired !== original.isRequired ||
  current.defaultValue !== original.defaultValue ||
  current.sortOrder !== original.sortOrder ||
  !arrayEqual(current.options, original.options) ||
  !arrayEqual(current.exclusiveOptions, original.exclusiveOptions);

export const hasChanges = (editor: EditorState): boolean =>
  editor.name !== editor.original.name ||
  editor.isDefault !== editor.original.isDefault ||
  editor.fields.length !== editor.original.fields.length ||
  editor.fields.some((current, index) =>
    fieldDiffers(current as FieldDef, editor.original.fields[index] as FieldDef),
  );

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
