import { Effect, Option, Stream } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore } from "../../../livestore/client";
import type { FieldDef } from "../../../livestore/schema";
import { init, subscriptions, update } from "../../../main";
import { Message } from "../../../messages";
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
  moveOptionInDraft,
  renumberFields,
  toggleExclusiveOption,
  withKindChanged,
} from "./editor";
import type { EditorState, FieldDraft } from "./editor";

const templateEditorModel = () =>
  init({
    protocol: "https:",
    host: "example.com",
    port: Option.none(),
    pathname: "/",
    search: Option.none(),
    hash: Option.some("#/templates/missing"),
  }).model;

describe("template detail regressions", () => {
  it("builds a new template locally and saves its questions in one command", () => {
    const opened = update(templateEditorModel(), Message.ClickedNewTemplate());
    expect(opened.commands ?? []).toHaveLength(0);
    expect(opened.model.editor?.name).toBe("");
    let model = update(opened.model, Message.ChangedEditorName({ text: "Morning study" })).model;
    model = update(model, Message.ClickedAddField()).model;
    model = update(model, Message.ChangedFieldName({ text: "Activity" })).model;
    const draft = model.editor!.draft;
    expect(update(model, Message.ClickedAddField()).model.editor!.draft).toBe(draft);
    expect(update(model, Message.ClickedSaveTemplate()).commands ?? []).toHaveLength(0);
    model = update(model, Message.ConfirmedSaveField()).model;
    const saved = update(model, Message.ClickedSaveTemplate());
    expect(saved.commands).toEqual([
      expect.objectContaining({
        name: "SaveTemplate",
        args: expect.objectContaining({
          isNew: true,
          name: "Morning study",
          fields: [expect.objectContaining({ name: "Activity", sortOrder: 0 })],
        }),
      }),
    ]);
    expect(update(saved.model, Message.ClickedSaveTemplate()).commands ?? []).toHaveLength(0);
  });

  it("distinguishes canceling one question from leaving the whole builder", () => {
    let model = update(templateEditorModel(), Message.ClickedNewTemplate()).model;
    model = update(model, Message.ClickedAddField()).model;
    model = update(model, Message.ChangedFieldName({ text: "Unfinished question" })).model;
    const cancelQuestion = update(model, Message.CanceledAddField());
    expect(cancelQuestion.model.showCreate).toBe(true);
    expect(cancelQuestion.model.editor?.draft).toBeNull();
    expect(cancelQuestion.model.editor?.pendingDiscard).toBe(false);
    const leave = update(model, Message.ClickedCancelEditTemplate());
    const discardedTemplate = update(leave.model, Message.ConfirmedDiscard());
    expect(discardedTemplate.model.editor).toBeNull();
    expect(discardedTemplate.model.showCreate).toBe(false);
  });

  it("retains the missing-template error while navigating back to templates", () => {
    const result = update(templateEditorModel(), Message.GotTemplateDetail({ template: null }));

    expect(result.model).toMatchObject({ editor: null, lastError: "Template not found." });
    expect(result.commands).toEqual([
      expect.objectContaining({ name: "NavigateInternal", args: { url: "#/templates" } }),
    ]);
  });

  it("does not treat the initial empty fields callback as a missing template", async () => {
    const callbacks: Array<(rows: ReadonlyArray<unknown>) => void> = [];
    vi.mocked(getStore).mockResolvedValue({
      subscribe: (_query: unknown, callback: (rows: ReadonlyArray<unknown>) => void) => {
        callbacks.push(callback);
        if (callbacks.length === 2) {
          callbacks[1]!([]);
          callbacks[0]!([{ id: "t1", name: "Template", isDefault: 0 }]);
        }
        return () => {};
      },
    } as unknown as Awaited<ReturnType<typeof getStore>>);

    const messages = await Effect.runPromise(
      subscriptions.templateDetail
        .dependenciesToStream({ templateId: "t1" })
        .pipe(Stream.take(1), Stream.runCollect),
    );

    expect(messages[0]).toMatchObject({
      _tag: "GotTemplateDetail",
      template: { id: "t1", fields: [] },
    });
  });
});

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

  it("requires ≥2 options when hasOptions", () => {
    const base = { ...makeEmptyDraft(0), name: "Category", kind: "radio" as const };
    expect(isDraftValid(base)).toBe(false);
    expect(isDraftValid({ ...base, options: ["A"] })).toBe(false);
    expect(isDraftValid({ ...base, options: ["A", "B"] })).toBe(true);
    const checkbox = {
      ...makeEmptyDraft(0),
      name: "Tools",
      kind: "checkbox" as const,
      options: [],
    };
    expect(isDraftValid(checkbox)).toBe(false);
    expect(isDraftValid({ ...checkbox, options: ["Computer"] })).toBe(false);
    expect(isDraftValid({ ...checkbox, options: ["Computer", "Phone"] })).toBe(true);
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

describe("cancel existing field", () => {
  it.each(["", "false", "true"])(
    "does not warn for an unchanged Yes/No default %j",
    (defaultValue) => {
      const existing = field({ id: "boolean", kind: "boolean", defaultValue, isRequired: false });
      const loaded = update(
        templateEditorModel(),
        Message.GotTemplateDetail({
          template: { id: "t1", name: "Template", isDefault: false, fields: [existing] },
        }),
      ).model;
      const opened = update(loaded, Message.ClickedEditField({ id: existing.id })).model;
      const back = update(opened, Message.ClickedBackFromField());
      expect(back.model.editor).toMatchObject({ draft: null, pendingDiscard: false });
      expect(back.model.editor?.fields).toEqual([existing]);

      const toggled = update(opened, Message.ToggledFieldDefaultBoolean()).model;
      expect(update(toggled, Message.ClickedBackFromField()).model.editor?.pendingDiscard).toBe(
        true,
      );
      const restored = update(toggled, Message.ToggledFieldDefaultBoolean()).model;
      expect(update(restored, Message.ClickedBackFromField()).model.editor).toMatchObject({
        draft: null,
        pendingDiscard: false,
      });
    },
  );

  const openField = () => {
    const existing = field({ id: "f1", name: "Activity", sortOrder: 0 });
    const loaded = update(
      templateEditorModel(),
      Message.GotTemplateDetail({
        template: { id: "t1", name: "Template", isDefault: false, fields: [existing] },
      }),
    ).model;
    return update(loaded, Message.ClickedEditField({ id: existing.id })).model;
  };

  it("closes immediately without a prompt when unchanged", () => {
    const result = update(openField(), Message.CanceledAddField());

    expect(result.model.editor).toMatchObject({
      editingFieldId: null,
      draft: null,
      pendingDiscard: false,
    });
  });

  it("prompts after an editable attribute changes", () => {
    const changed = update(openField(), Message.ChangedFieldName({ text: "Changed" })).model;
    const result = update(changed, Message.ClickedBackFromField());

    expect(result.model.editor).toMatchObject({ editingFieldId: "f1", pendingDiscard: true });
  });

  it("does not prompt after a change is restored", () => {
    const changed = update(openField(), Message.ChangedFieldName({ text: "Changed" })).model;
    const restored = update(changed, Message.ChangedFieldName({ text: "Activity" })).model;
    const result = update(restored, Message.ClickedBackFromField());

    expect(result.model.editor).toMatchObject({
      editingFieldId: null,
      draft: null,
      pendingDiscard: false,
    });
  });

  it("prompts when option text has not been added", () => {
    const changed = update(openField(), Message.ChangedNewOptionText({ text: "New option" })).model;
    const result = update(changed, Message.ClickedBackFromField());

    expect(result.model.editor).toMatchObject({ editingFieldId: "f1", pendingDiscard: true });
  });
});

describe("cancel new field", () => {
  const openField = () => {
    const loaded = update(
      templateEditorModel(),
      Message.GotTemplateDetail({
        template: { id: "t1", name: "Template", isDefault: false, fields: [] },
      }),
    ).model;
    return update(loaded, Message.ClickedAddField()).model;
  };

  it("closes immediately without a prompt when unchanged", () => {
    const result = update(openField(), Message.CanceledAddField());

    expect(result.model.editor).toMatchObject({
      showAddField: false,
      draft: null,
      pendingDiscard: false,
    });
  });

  it.each([
    ["name", { name: "Activity" }],
    ["kind", { kind: "textArea" as const }],
    ["required", { isRequired: true }],
    ["default value", { defaultValue: "Default" }],
    ["options", { options: ["Option"] }],
    ["unadded option text", { newOptionText: "Option" }],
  ])("prompts after changing %s", (_attribute, changedDraft) => {
    const opened = openField();
    const changed = {
      ...opened,
      editor:
        opened.editor === null || opened.editor.draft === null
          ? opened.editor
          : {
              ...opened.editor,
              draft: { ...opened.editor.draft, ...changedDraft },
            },
    };
    const result = update(changed, Message.ClickedBackFromField());

    expect(result.model.editor).toMatchObject({ showAddField: true, pendingDiscard: true });
    const canceled = update(changed, Message.CanceledAddField());
    expect(canceled.model.editor).toMatchObject({
      draft: null,
      showAddField: false,
      pendingDiscard: false,
    });
    expect(canceled.model.editor?.fields).toEqual(opened.editor?.fields);
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

describe.each([
  ["textInput", "textArea"],
  ["textArea", "textInput"],
] as const)("withKindChanged from %s to %s", (kind, nextKind) => {
  it.each(["true", "false"])("preserves literal text default %s", (defaultValue) => {
    const draft = { ...makeEmptyDraft(0), kind, defaultValue };
    expect(withKindChanged(draft, nextKind).defaultValue).toBe(defaultValue);
  });
});

describe("text default newline conversion", () => {
  it.each([
    ["CR", "first\rsecond", "firstsecond"],
    ["LF", "first\nsecond", "firstsecond"],
    ["CRLF", "first\r\nsecond", "firstsecond"],
  ])("strips %s when converting textArea to textInput", (_label, defaultValue, expected) => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Notes",
      kind: "textArea" as const,
      defaultValue,
    };

    expect(withKindChanged(draft, "textInput").defaultValue).toBe(expected);
    expect(withKindChanged(draft, "textArea").defaultValue).toBe(defaultValue);
  });

  it("saves the normalized converted draft", () => {
    const loaded = update(
      templateEditorModel(),
      Message.GotTemplateDetail({
        template: { id: "t1", name: "Template", isDefault: false, fields: [] },
      }),
    ).model;
    const opened = update(loaded, Message.ClickedAddField()).model;
    const named = update(opened, Message.ChangedFieldName({ text: "Notes" })).model;
    const multiline = update(named, Message.ChangedFieldKind({ kind: "textArea" })).model;
    const defaulted = update(
      multiline,
      Message.ChangedFieldDefaultValue({ text: "first\r\nsecond" }),
    ).model;
    const converted = update(defaulted, Message.ChangedFieldKind({ kind: "textInput" })).model;
    const saved = update(converted, Message.ConfirmedSaveField()).model;

    expect(converted.editor?.draft?.defaultValue).toBe("firstsecond");
    expect(saved.editor?.fields[0]?.defaultValue).toBe("firstsecond");
  });
});

describe.each(["textInput", "textArea"] as const)(
  "withKindChanged from boolean to %s",
  (nextKind) => {
    it.each(["true", "false"])("clears boolean default %s", (defaultValue) => {
      const draft = { ...makeEmptyDraft(0), kind: "boolean" as const, defaultValue };
      expect(withKindChanged(draft, nextKind).defaultValue).toBe("");
    });
  },
);

describe("draftToFieldDef normalization", () => {
  it.each(["radio", "checkbox"] as const)(
    "clears stale %s defaults and preserves valid ones",
    (kind) => {
      const draft = { ...makeEmptyDraft(0), name: "Choice", kind, options: ["A", "B"] };
      expect(draftToFieldDef({ ...draft, defaultValue: "old text" }).defaultValue).toBe("");
      expect(draftToFieldDef({ ...draft, defaultValue: "A" }).defaultValue).toBe("A");
      expect(draftToFieldDef({ ...draft, defaultValue: "A,B" }).defaultValue).toBe(
        kind === "checkbox" ? "A,B" : "",
      );
      const removed = deleteOptionFromDraft({ ...draft, defaultValue: "A" }, 0);
      expect(draftToFieldDef(removed).defaultValue).toBe("");
    },
  );

  it.each(["radio", "checkbox"] as const)("clears text defaults when changing to %s", (kind) => {
    for (const textKind of ["textInput", "textArea"] as const) {
      const draft = { ...makeEmptyDraft(0), kind: textKind, defaultValue: "stale text" };
      expect(withKindChanged(draft, kind).defaultValue).toBe("");
    }
  });

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
  it.each(["radio", "checkbox"] as const)(
    "reorders %s choices without changing defaults or exclusivity",
    (kind) => {
      const draft: FieldDraft = {
        ...makeEmptyDraft(0),
        name: "Activity",
        kind,
        options: ["Work", "Wait", "None"],
        defaultValue: "Wait",
        exclusiveOptions: kind === "checkbox" ? ["None"] : [],
      };
      const moved = moveOptionInDraft(draft, 1, -1);
      expect(moved.options).toEqual(["Wait", "Work", "None"]);
      expect(moveOptionInDraft(moved, 1, 1).options).toEqual(["Wait", "None", "Work"]);
      expect(moved.defaultValue).toBe("Wait");
      expect(moved.exclusiveOptions).toEqual(draft.exclusiveOptions);
      expect(draft.options).toEqual(["Work", "Wait", "None"]);
      expect(draftToFieldDef(moved).options).toEqual(["Wait", "Work", "None"]);
      for (const [index, direction] of [
        [0, -1],
        [2, 1],
        [-1, 1],
        [3, -1],
      ] as const) {
        expect(moveOptionInDraft(draft, index, direction)).toBe(draft);
      }
    },
  );

  it("rejects comma-bearing checkbox names without losing the input", () => {
    const draft = {
      ...makeEmptyDraft(0),
      name: "Tools",
      kind: "checkbox" as const,
      options: ["A", "B"],
      newOptionText: " Pen, paper ",
    };
    expect(addOptionToDraft(draft)).toBe(draft);
    expect(isDraftValid({ ...draft, options: ["A", "Pen, paper"] })).toBe(false);
    const radio = { ...draft, kind: "radio" as const };
    expect(addOptionToDraft(radio).options).toEqual(["A", "B", "Pen, paper"]);
    expect(isDraftValid(withKindChanged(addOptionToDraft(radio), "checkbox"))).toBe(false);
    expect(addOptionToDraft({ ...draft, newOptionText: " Pen and paper " }).options).toEqual([
      "A",
      "B",
      "Pen and paper",
    ]);
  });

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
