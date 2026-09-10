import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { getStore } from "../../../livestore/client";
import { events, tables, type FieldDef } from "../../../livestore/schema";
import { friendlyFailure } from "../../errors";
import { fieldRowsToDefs } from "../../fieldRows";
import { nextDuplicateName } from "./naming";

// Commands for the Templates tab. Each awaits the store handle (FoldKit has
// no store hook), commits events, and reports back through a message.

export const CreateTemplate = Command.define("CreateTemplate", {
  args: { id: S.String, name: S.String },
  messages: [Message.TemplateCreated, Message.FailedTemplateOp],
  execute: ({ id, name }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      // First template ever becomes the default automatically
      const existing = store.query(tables.templates.select()) as ReadonlyArray<{ id: string }>;
      store.commit(
        events.templateCreated({
          id,
          name: name.trim(),
          isDefault: existing.length === 0,
          now: new Date(),
        }),
      );
      return Message.TemplateCreated();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("create", cause) })),
      ),
    ),
});

export const SetDefaultTemplate = Command.define("SetDefaultTemplate", {
  args: { id: S.String },
  messages: [Message.TemplateOpDone, Message.FailedTemplateOp],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      store.commit(events.templateDefaultSet({ id }));
      return Message.TemplateOpDone();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("save", cause) })),
      ),
    ),
});

export const DuplicateTemplate = Command.define("DuplicateTemplate", {
  args: { id: S.String },
  messages: [Message.DuplicatedTemplate, Message.FailedTemplateOp],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const templates = store.query(tables.templates.select()) as ReadonlyArray<{
        readonly id: string;
        readonly name: string;
      }>;
      const source = templates.find((t) => t.id === id);
      if (source === undefined) return yield* effectFailure("Template no longer exists.");
      const fieldRows = store.query(
        tables.templateFields.select().where({ templateId: id }).orderBy("sortOrder", "asc"),
      ) as Parameters<typeof fieldRowsToDefs>[0];
      const fields = fieldRowsToDefs(fieldRows).map((field) => ({
        ...field,
        id: crypto.randomUUID(),
      }));
      const copyId = crypto.randomUUID();
      const copyName = nextDuplicateName(
        source.name,
        templates.map((t) => t.name),
      );
      store.commit(
        events.templateCreated({ id: copyId, name: copyName, isDefault: false, now: new Date() }),
        events.fieldsReplaced({ templateId: copyId, fields }),
      );
      return Message.DuplicatedTemplate({ id: copyId });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("duplicate", cause) })),
      ),
    ),
});

export const DeleteTemplate = Command.define("DeleteTemplate", {
  args: { id: S.String },
  messages: [Message.TemplateOpDone, Message.FailedTemplateOp],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const templates = store.query(tables.templates.select()) as ReadonlyArray<{
        readonly id: string;
        readonly isDefault: number;
        readonly createdAt: Date;
      }>;
      const target = templates.find((t) => t.id === id);
      if (target === undefined) return Message.TemplateOpDone();
      // Deleting the default promotes the earliest other template BEFORE deletion
      const remaining = templates.filter((t) => t.id !== id);
      const promote =
        target.isDefault === 1 && remaining.length > 0
          ? [
              events.templateDefaultSet({
                id: remaining.reduce((a, b) =>
                  a.createdAt.getTime() <= b.createdAt.getTime() ? a : b,
                ).id,
              }),
            ]
          : [];
      store.commit(...promote, events.templateDeleted({ id }));
      return Message.TemplateOpDone();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("delete", cause) })),
      ),
    ),
});

// ── Sample templates ───────────────────────────────────────────────────────

const field = (
  name: string,
  kind: FieldDef["kind"],
  isRequired: boolean,
  sortOrder: number,
  options: ReadonlyArray<string> = [],
  exclusiveOptions: ReadonlyArray<string> = [],
  defaultValue = "",
): FieldDef => ({
  id: crypto.randomUUID(),
  name,
  kind,
  isRequired,
  defaultValue,
  sortOrder,
  options: [...options],
  exclusiveOptions: [...exclusiveOptions],
});

export type SampleTemplate = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly fields: ReadonlyArray<FieldDef>;
};

/**
 * Three ready-made studies, one per setting, each showing every answer type:
 * a short text answer, single choice, multiple choice (with a "None" choice
 * that clears the others), Yes/No and free notes.
 */
export const sampleTemplates = (): ReadonlyArray<SampleTemplate> => [
  {
    id: crypto.randomUUID(),
    name: "Assembly line",
    isDefault: true,
    fields: [
      field("Station", "radio", true, 0, [
        "Station 1",
        "Station 2",
        "Station 3",
        "Station 4",
        "Station 5",
        "Rework",
      ]),
      field("Operation", "textInput", true, 1),
      field("Task type", "radio", true, 2, [
        "Value-added",
        "Walking",
        "Waiting",
        "Setup",
        "Inspection",
        "Rework",
      ]),
      field(
        "Tools used",
        "checkbox",
        false,
        3,
        ["Torque driver", "Hoist", "Scanner", "Hand tools", "None"],
        ["None"],
      ),
      field("Interrupted", "boolean", false, 4),
      field("Notes", "textArea", false, 5),
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Ward round",
    isDefault: false,
    fields: [
      field("Location", "radio", true, 0, [
        "Bed",
        "Nurses’ station",
        "Treatment room",
        "Corridor",
        "Office",
      ]),
      field("Activity", "textInput", true, 1),
      field("Care type", "radio", true, 2, [
        "Direct care",
        "Documentation",
        "Handover",
        "Medication",
        "Waiting",
        "Other",
      ]),
      field(
        "Equipment used",
        "checkbox",
        false,
        3,
        ["Trolley", "Computer on wheels", "Monitor", "Phone", "None"],
        ["None"],
      ),
      field("Patient present", "boolean", false, 4),
      field("Notes", "textArea", false, 5),
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "Warehouse pick",
    isDefault: false,
    fields: [
      field("Zone", "radio", true, 0, ["A", "B", "C", "Packing", "Dock"]),
      field("Order/task", "textInput", true, 1),
      field("Activity", "radio", true, 2, [
        "Walking",
        "Picking",
        "Scanning",
        "Packing",
        "Waiting",
        "Searching",
      ]),
      field(
        "Aids used",
        "checkbox",
        false,
        3,
        ["Handheld scanner", "Trolley", "Forklift", "Pick list", "None"],
        ["None"],
      ),
      field("Item damaged", "boolean", false, 4),
      field("Notes", "textArea", false, 5),
    ],
  },
];

/** Seeds the three sample templates exactly once, when zero templates exist. */
export const EnsureTemplatesSeeded = Command.define("EnsureTemplatesSeeded", {
  args: {},
  messages: [Message.TemplatesSeededCheck, Message.FailedTemplateOp],
  execute: () =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const existing = store.query(tables.templates.select()) as ReadonlyArray<{ id: string }>;
      if (existing.length > 0) return Message.TemplatesSeededCheck();
      store.commit(events.templatesSeeded({ templates: sampleTemplates(), now: new Date() }));
      return Message.TemplatesSeededCheck();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("create", cause) })),
      ),
    ),
});

/**
 * Adds the sample templates the user doesn't have yet, by name. Never changes
 * which template is the default unless the app has none at all.
 */
export const AddSampleTemplates = Command.define("AddSampleTemplates", {
  args: {},
  messages: [Message.SampleTemplatesAdded, Message.FailedTemplateOp],
  execute: () =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const existing = store.query(tables.templates.select()) as ReadonlyArray<{
        readonly name: string;
      }>;
      const taken = new Set(existing.map((t) => t.name));
      const missing = sampleTemplates()
        .filter((template) => !taken.has(template.name))
        .map((template, index) => ({
          ...template,
          isDefault: existing.length === 0 && index === 0,
        }));
      if (missing.length > 0)
        store.commit(events.templatesSeeded({ templates: missing, now: new Date() }));
      return Message.SampleTemplatesAdded();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("create", cause) })),
      ),
    ),
});

const effectFailure = (message: string) => Effect.fail(new Error(message));
