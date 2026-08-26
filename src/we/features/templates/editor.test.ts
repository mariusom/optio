import { describe, expect, it } from "vitest";

import type { FieldDef } from "../../../livestore/schema";
import {
  addOptionToDraft,
  deleteField,
  deleteOptionFromDraft,
  draftToFieldDef,
  hasChanges,
  isDraftValid,
  isTemplateValid,
  makeEmptyDraft,
  moveField,
  renumberFields,
  toggleExclusiveOption,
} from "./editor";
import type { EditorState, FieldDraft } from "./editor";

const field = (overrides: Partial<FieldDef> & { id: string }): FieldDef => ({
  name: "Field",
  kind: "textInput",
  isRequired: false,
  defaultValue: "",
  sortOrder: 0,
  options: [],
  exclusiveOptions: [],
  ...overrides,
});

const editorFrom = (
  fields: ReadonlyArray<FieldDef>,
  name = "Template",
  isDefault = false,
): EditorState => ({
  id: "t1",
  name,
  isDefault,
  fields,
  original: { name, isDefault, fields: [...fields] },
  isSaving: false,
  showAddField: false,
  editingFieldId: null,
  draft: null,
  pendingDiscard: false,
});

describe("isTemplateValid", () => {
  it("requires non-empty trimmed name", () => {
    expect(isTemplateValid({ name: "" })).toBe(false);
    expect(isTemplateValid({ name: "   " })).toBe(false);
    expect(isTemplateValid({ name: "Study" })).toBe(true);
    expect(isTemplateValid({ name: "  Study  " })).toBe(true);
  });
});

describe("isDraftValid", () => {
  it("requires trimmed name", () => {
    const draft = makeEmptyDraft(0);
    expect(isDraftValid(draft)).toBe(false);
    expect(isDraftValid({ ...draft, name: "   " })).toBe(false);
    expect(isDraftValid({ ...draft, name: "Activity" })).toBe(true);
  });

  it("requires ≥1 option when hasOptions", () => {
    const base = { ...makeEmptyDraft(0), name: "Category", kind: "radio" as const };
    expect(isDraftValid(base)).toBe(false);
    expect(isDraftValid({ ...base, options: ["A"] })).toBe(true);
    const checkbox = {
      ...makeEmptyDraft(0),
      name: "Tools",
      kind: "checkbox" as const,
      options: [],
    };
    expect(isDraftValid(checkbox)).toBe(false);
    expect(isDraftValid({ ...checkbox, options: ["Computer"] })).toBe(true);
  });

  it("textInput and boolean pass without options", () => {
    expect(isDraftValid({ ...makeEmptyDraft(0), name: "Notes", kind: "textArea" })).toBe(true);
    expect(isDraftValid({ ...makeEmptyDraft(0), name: "Interrupted", kind: "boolean" })).toBe(true);
  });
});

describe("hasChanges", () => {
  it("false when pristine", () => {
    const fields = [field({ id: "f1", name: "Activity", sortOrder: 0 })];
    expect(hasChanges(editorFrom(fields))).toBe(false);
  });

  it("detects name change", () => {
    const fields = [field({ id: "f1", sortOrder: 0 })];
    const editor = editorFrom(fields, "Original");
    expect(hasChanges({ ...editor, name: "Changed" })).toBe(true);
  });

  it("detects isDefault change", () => {
    const fields: ReadonlyArray<FieldDef> = [];
    const editor = editorFrom(fields, "T", false);
    expect(hasChanges({ ...editor, isDefault: true })).toBe(true);
  });

  it("detects field add/remove", () => {
    const f1 = field({ id: "f1", sortOrder: 0 });
    const f2 = field({ id: "f2", sortOrder: 1 });
    const editor = editorFrom([f1]);
    expect(hasChanges({ ...editor, fields: [f1, f2] })).toBe(true);
    expect(hasChanges({ ...editor, fields: [] })).toBe(true);
  });

  it("detects deep field changes: name,kind,isRequired,defaultValue,options,exclusive", () => {
    const base = field({
      id: "f1",
      name: "Category",
      kind: "radio",
      isRequired: true,
      defaultValue: "",
      sortOrder: 0,
      options: ["A", "B"],
      exclusiveOptions: [],
    });
    const editor = editorFrom([base]);
    expect(hasChanges({ ...editor, fields: [{ ...base, name: "Renamed" }] })).toBe(true);
    expect(hasChanges({ ...editor, fields: [{ ...base, kind: "checkbox" }] })).toBe(true);
    expect(hasChanges({ ...editor, fields: [{ ...base, isRequired: false }] })).toBe(true);
    expect(hasChanges({ ...editor, fields: [{ ...base, defaultValue: "A" }] })).toBe(true);
    expect(hasChanges({ ...editor, fields: [{ ...base, options: ["A"] }] })).toBe(true);
    expect(
      hasChanges({
        ...editor,
        fields: [{ ...base, options: ["A", "B"], exclusiveOptions: ["B"] }],
      }),
    ).toBe(true);
  });

  it("detects reorder via id mismatch", () => {
    const f1 = field({ id: "f1", sortOrder: 0 });
    const f2 = field({ id: "f2", sortOrder: 1 });
    const editor = editorFrom([f1, f2]);
    expect(hasChanges({ ...editor, fields: [f2, f1] })).toBe(true);
  });

  it("detects sortOrder change", () => {
    const f1 = field({ id: "f1", sortOrder: 0 });
    const editor = editorFrom([f1]);
    expect(hasChanges({ ...editor, fields: [{ ...f1, sortOrder: 99 }] })).toBe(true);
  });
});

describe("renumberFields", () => {
  it("renumbers densely 0..n-1 preserving order", () => {
    const fields = [
      field({ id: "a", sortOrder: 5 }),
      field({ id: "b", sortOrder: 10 }),
      field({ id: "c", sortOrder: 99 }),
    ];
    const renumbered = renumberFields(fields);
    expect(renumbered.map((f) => f.sortOrder)).toEqual([0, 1, 2]);
    expect(renumbered.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("empty and single remain correct", () => {
    expect(renumberFields([])).toEqual([]);
    expect(renumberFields([field({ id: "x", sortOrder: 42 })]).map((f) => f.sortOrder)).toEqual([
      0,
    ]);
  });
});

describe("moveField", () => {
  it("moves up and renumbers", () => {
    const a = field({ id: "a", sortOrder: 0 });
    const b = field({ id: "b", sortOrder: 1 });
    const c = field({ id: "c", sortOrder: 2 });
    const moved = moveField([a, b, c], "b", -1);
    expect(moved.map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(moved.map((f) => f.sortOrder)).toEqual([0, 1, 2]);
  });

  it("moves down and renumbers", () => {
    const a = field({ id: "a", sortOrder: 0 });
    const b = field({ id: "b", sortOrder: 1 });
    const c = field({ id: "c", sortOrder: 2 });
    expect(moveField([a, b, c], "a", 1).map((f) => f.id)).toEqual(["b", "a", "c"]);
  });

  it("no-ops at boundaries", () => {
    const a = field({ id: "a", sortOrder: 0 });
    const b = field({ id: "b", sortOrder: 1 });
    expect(moveField([a, b], "a", -1).map((f) => f.id)).toEqual(["a", "b"]);
    expect(moveField([a, b], "b", 1).map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("no-ops for missing id", () => {
    const a = field({ id: "a", sortOrder: 0 });
    expect(moveField([a], "missing", 1)).toEqual([a]);
  });
});

describe("deleteField", () => {
  it("removes and renumbers densely", () => {
    const a = field({ id: "a", sortOrder: 0 });
    const b = field({ id: "b", sortOrder: 1 });
    const c = field({ id: "c", sortOrder: 2 });
    const next = deleteField([a, b, c], "b");
    expect(next.map((f) => f.id)).toEqual(["a", "c"]);
    expect(next.map((f) => f.sortOrder)).toEqual([0, 1]);
  });
});

describe("draftToFieldDef normalization", () => {
  it("boolean forces isRequired false and normalizes default", () => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Interrupted",
      kind: "boolean" as const,
      isRequired: true,
      defaultValue: "maybe",
    };
    const def = draftToFieldDef(draft);
    expect(def.isRequired).toBe(false);
    expect(def.defaultValue).toBe("false");
    expect(draftToFieldDef({ ...draft, defaultValue: "true" }).defaultValue).toBe("true");
  });

  it("non-option types clear options and exclusive", () => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Notes",
      kind: "textArea" as const,
      options: ["A"],
      exclusiveOptions: ["A"],
    };
    const def = draftToFieldDef(draft);
    expect(def.options).toEqual([]);
    expect(def.exclusiveOptions).toEqual([]);
  });

  it("checkbox keeps exclusive only if still in options", () => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Tools",
      kind: "checkbox" as const,
      options: ["A", "B"],
      exclusiveOptions: ["B", "C"],
    };
    const def = draftToFieldDef(draft);
    expect(def.exclusiveOptions).toEqual(["B"]);
  });

  it("trims name", () => {
    const draft = { ...makeEmptyDraft(0), name: "  Activity  ", kind: "textInput" as const };
    expect(draftToFieldDef(draft).name).toBe("Activity");
  });
});

describe("option helpers", () => {
  it("addOptionToDraft trims, ignores blank and duplicate", () => {
    let draft = {
      ...makeEmptyDraft(0),
      name: "Cat",
      kind: "radio" as const,
      options: ["A"],
      newOptionText: "  ",
    };
    expect(addOptionToDraft(draft).options).toEqual(["A"]);
    draft = { ...draft, newOptionText: "A" };
    expect(addOptionToDraft(draft).options).toEqual(["A"]);
    expect(addOptionToDraft(draft).newOptionText).toBe("");
    draft = { ...draft, newOptionText: " B " };
    const next = addOptionToDraft(draft);
    expect(next.options).toEqual(["A", "B"]);
    expect(next.newOptionText).toBe("");
  });

  it("deleteOption removes option and its exclusive", () => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Tools",
      kind: "checkbox" as const,
      options: ["A", "B", "None"],
      exclusiveOptions: ["None"],
    };
    const after = deleteOptionFromDraft(draft, 2);
    expect(after.options).toEqual(["A", "B"]);
    expect(after.exclusiveOptions).toEqual([]);
  });

  it("toggleExclusiveOption adds/removes", () => {
    let draft: FieldDraft = {
      ...makeEmptyDraft(0),
      name: "Tools",
      kind: "checkbox",
      options: ["A", "None"],
      exclusiveOptions: [],
    };
    draft = toggleExclusiveOption(draft, 1);
    expect(draft.exclusiveOptions).toEqual(["None"]);
    draft = toggleExclusiveOption(draft, 1);
    expect(draft.exclusiveOptions).toEqual([]);
  });

  it("toggleExclusive does nothing for non-checkbox", () => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Cat",
      kind: "radio" as const,
      options: ["A"],
      exclusiveOptions: [],
    };
    expect(toggleExclusiveOption(draft, 0).exclusiveOptions).toEqual([]);
  });
});
