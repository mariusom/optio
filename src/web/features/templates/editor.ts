import { Array, Option, pipe, String } from "effect";

import type { FieldDef, FieldKind } from "../../../domain/fields";
import { hasOptions, isScalarAnswerValid } from "../../fields";

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
  if (nextKind === "textInput") {
    next = { ...next, defaultValue: pipe(next.defaultValue, String.replace(/[\r\n]/g, "")) };
  }
  if (!hasOptions(nextKind)) {
    next = { ...next, options: [], exclusiveOptions: [], newOptionText: "" };
  }
  if (hasOptions(nextKind) && nextKind !== draft.kind) {
    next = { ...next, defaultValue: "" };
  }
  if (nextKind === "boolean") {
    const current = next.defaultValue;
    next = { ...next, defaultValue: isScalarAnswerValid(nextKind, current) ? current : "" };
  } else if (
    draft.kind === "boolean" &&
    (next.defaultValue === "true" || next.defaultValue === "false")
  ) {
    // Coming from boolean to text types, clear boolean-style default
    next = { ...next, defaultValue: "" };
  }
  if (nextKind === "checkbox" && next.exclusiveOptions.length > 0) {
    next = {
      ...next,
      exclusiveOptions: Array.filter(next.exclusiveOptions, (option) =>
        next.options.includes(option),
      ),
    };
  }
  if (nextKind !== "checkbox") next = { ...next, exclusiveOptions: [] };
  if (!isScalarAnswerValid(nextKind, next.defaultValue)) next = { ...next, defaultValue: "" };
  return next;
};

// ── Validation ─────────────────────────────────────────────────────────────

export const isTemplateValid = (editor: { readonly name: string }): boolean =>
  String.trim(editor.name).length > 0;

export const isDraftValid = (draft: FieldDraft): boolean => {
  if (String.trim(draft.name).length === 0) return false;
  if (!isScalarAnswerValid(draft.kind, draft.defaultValue)) return false;
  if (hasOptions(draft.kind) && draft.options.length < 2) return false;
  if (
    draft.kind === "checkbox" &&
    Array.some(draft.options, (option) => pipe(option, String.includes(",")))
  ) {
    return false;
  }
  return true;
};

// ── hasChanges — deep diff of id,name,kind,isRequired,options,exclusive,defaultValue + name/default ──

const arrayEqual = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean =>
  a.length === b.length && Array.every(a, (value, index) => value === b[index]);

/** One field's dirty check: identity + every editable attribute. */
export const fieldDiffers = (current: FieldDef, original: FieldDef): boolean =>
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
  Array.some(editor.fields, (current, index) =>
    fieldDiffers(current as FieldDef, editor.original.fields[index] as FieldDef),
  );

// ── Sort order helpers — dense renumber after moves/deletes ───────────────

export const renumberFields = (fields: ReadonlyArray<FieldDef>): ReadonlyArray<FieldDef> =>
  Array.map(fields, (field, index) => ({ ...field, sortOrder: index }));

export const moveField = (
  fields: ReadonlyArray<FieldDef>,
  id: string,
  direction: -1 | 1,
): ReadonlyArray<FieldDef> => {
  const found = Array.findFirstIndex(fields, (field) => field.id === id);
  if (Option.isNone(found)) return fields;
  const index = found.value;
  const target = index + direction;
  if (target < 0 || target >= fields.length) return fields;
  const next = [...fields];
  const temporary = next[index] as FieldDef;
  next[index] = next[target] as FieldDef;
  next[target] = temporary;
  return renumberFields(next);
};

export const deleteField = (fields: ReadonlyArray<FieldDef>, id: string): ReadonlyArray<FieldDef> =>
  renumberFields(Array.filter(fields, (field) => field.id !== id));

// ── Draft → FieldDef conversion with normalization ──────────────────────────

export const draftToFieldDef = (draft: FieldDraft): FieldDef => {
  const kind: FieldKind = draft.kind;
  const hasOpts = hasOptions(kind);
  const options = hasOpts ? [...draft.options] : [];
  const exclusiveOptions =
    kind === "checkbox"
      ? Array.filter(draft.exclusiveOptions, (option) => options.includes(option))
      : [];
  let defaultValue = draft.defaultValue;
  if (kind === "boolean") {
    defaultValue = isScalarAnswerValid(kind, defaultValue) ? defaultValue : "";
  }
  if (hasOpts && defaultValue !== "") {
    const defaults = kind === "checkbox" ? String.split(defaultValue, ",") : [defaultValue];
    if (!Array.every(defaults, (option) => options.includes(option))) defaultValue = "";
  }
  return {
    id: draft.id,
    name: String.trim(draft.name),
    kind,
    isRequired: draft.isRequired,
    defaultValue,
    sortOrder: draft.sortOrder,
    options,
    exclusiveOptions,
  };
};

export const makeEmptyDraft = (id: string, sortOrder: number): FieldDraft => ({
  id,
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

export const moveOptionInDraft = (
  draft: FieldDraft,
  index: number,
  direction: -1 | 1,
): FieldDraft => {
  const target = index + direction;
  if (index < 0 || index >= draft.options.length || target < 0 || target >= draft.options.length)
    return draft;
  const options = [...draft.options];
  [options[index], options[target]] = [options[target]!, options[index]!];
  return { ...draft, options };
};

export const addOptionToDraft = (draft: FieldDraft): FieldDraft => {
  const trimmed = String.trim(draft.newOptionText);
  if (trimmed === "") return draft;
  if (draft.kind === "checkbox" && pipe(trimmed, String.includes(","))) return draft;
  if (draft.options.includes(trimmed)) return { ...draft, newOptionText: "" };
  return { ...draft, options: [...draft.options, trimmed], newOptionText: "" };
};

export const deleteOptionFromDraft = (draft: FieldDraft, index: number): FieldDraft => {
  const options = Array.filter(draft.options, (_, candidate) => candidate !== index);
  const removed = draft.options[index];
  const exclusiveOptions =
    removed === undefined
      ? draft.exclusiveOptions
      : Array.filter(draft.exclusiveOptions, (option) => option !== removed);
  return { ...draft, options, exclusiveOptions };
};

export const toggleExclusiveOption = (draft: FieldDraft, index: number): FieldDraft => {
  const option = draft.options[index];
  if (option === undefined) return draft;
  if (draft.kind !== "checkbox") return draft;
  const isExclusive = draft.exclusiveOptions.includes(option);
  const exclusiveOptions = isExclusive
    ? Array.filter(draft.exclusiveOptions, (candidate) => candidate !== option)
    : [...draft.exclusiveOptions, option];
  return { ...draft, exclusiveOptions };
};
