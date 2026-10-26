import { Array, DateTime, Effect, Option, pipe, Schema, String } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { withStore } from "../../../livestore/access";
import type { FieldDef } from "../../../domain/fields";
import { reportFailure } from "../../errors";
import { fieldRowsToDefs } from "../../fieldRows";
import { nextDuplicateName } from "./naming";
import { randomUuid, withFreshIds, withRandomUuids } from "../../../lib/ids";

const failedTemplateOp = (error: string) => Message.FailedTemplateOp({ error });

// Commands for the Templates tab. Each awaits the store handle (FoldKit has
// no store hook), commits events, and reports back through a message.

export const CreateTemplate = Command.define("CreateTemplate", {
  args: { id: Schema.String, name: Schema.String },
  messages: [Message.TemplateCreated, Message.FailedTemplateOp],
  execute: ({ id, name }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const now = yield* DateTime.nowAsDate;
        // First template ever becomes the default automatically
        const existing = store.query(tables.templates.select());
        store.commit(
          events.templateCreated({
            id,
            name: String.trim(name),
            isDefault: existing.length === 0,
            now,
          }),
        );
        return Message.TemplateCreated();
      }),
    ).pipe(reportFailure("create", failedTemplateOp)),
});

export const SetDefaultTemplate = Command.define("SetDefaultTemplate", {
  args: { id: Schema.String },
  messages: [Message.TemplateOpDone, Message.FailedTemplateOp],
  execute: ({ id }) =>
    withStore(({ store, events }) =>
      Effect.sync(() => {
        store.commit(events.templateDefaultSet({ id }));
        return Message.TemplateOpDone();
      }),
    ).pipe(reportFailure("save", failedTemplateOp)),
});

export const DuplicateTemplate = Command.define("DuplicateTemplate", {
  args: { id: Schema.String },
  messages: [Message.DuplicatedTemplate, Message.FailedTemplateOp],
  execute: ({ id }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const now = yield* DateTime.nowAsDate;
        const templates = store.query(tables.templates.select());
        const found = Array.findFirst(templates, (t) => t.id === id);
        if (Option.isNone(found)) return failedTemplateOp("That template no longer exists.");
        const source = found.value;
        const fieldRows = store.query(
          tables.templateFields.select().where({ templateId: id }).orderBy("sortOrder", "asc"),
        );
        const fields = yield* withFreshIds(fieldRowsToDefs(fieldRows));
        const copyId = yield* randomUuid;
        const copyName = nextDuplicateName(
          source.name,
          Array.map(templates, (t) => t.name),
        );
        store.commit(
          events.templateCreated({ id: copyId, name: copyName, isDefault: false, now }),
          events.fieldsReplaced({ templateId: copyId, fields }),
        );
        return Message.DuplicatedTemplate({ id: copyId });
      }),
    ).pipe(reportFailure("duplicate", failedTemplateOp)),
});

export const DeleteTemplate = Command.define("DeleteTemplate", {
  args: { id: Schema.String },
  messages: [Message.TemplateOpDone, Message.FailedTemplateOp],
  execute: ({ id }) =>
    withStore(({ store, tables, events }) =>
      Effect.sync(() => {
        const templates = store.query(tables.templates.select());
        const target = Array.findFirst(templates, (t) => t.id === id);
        if (Option.isNone(target)) return Message.TemplateOpDone();
        // Deleting the default promotes the earliest other template BEFORE deletion
        const [firstRemaining, ...laterRemaining] = Array.filter(templates, (t) => t.id !== id);
        const promote =
          target.value.isDefault === 1 && firstRemaining !== undefined
            ? [
                events.templateDefaultSet({
                  // Ties keep the earlier template.
                  id: Array.reduce(laterRemaining, firstRemaining, (a, b) =>
                    a.createdAt.getTime() <= b.createdAt.getTime() ? a : b,
                  ).id,
                }),
              ]
            : [];
        store.commit(...promote, events.templateDeleted({ id }));
        return Message.TemplateOpDone();
      }),
    ).pipe(reportFailure("delete", failedTemplateOp)),
});

// ── Sample templates ───────────────────────────────────────────────────────

/** Builds sample questions with IDs from `newId`, supplied by the running Command. */
const fieldsWith =
  (newId: () => string) =>
  (
    name: string,
    kind: FieldDef["kind"],
    {
      isRequired,
      sortOrder,
      options = [],
      exclusiveOptions = [],
      defaultValue = "",
    }: Readonly<{
      isRequired: boolean;
      sortOrder: number;
      options?: ReadonlyArray<string>;
      exclusiveOptions?: ReadonlyArray<string>;
      defaultValue?: string;
    }>,
  ): FieldDef => ({
    id: newId(),
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
 * Three introductory studies plus a quantitative measurement demo:
 * a short text answer, single choice, multiple choice (with a "None" choice
 * that clears the others), Yes/No and free notes.
 */
export const sampleTemplates = (newId: () => string): ReadonlyArray<SampleTemplate> => {
  const field = fieldsWith(newId);
  return [
    {
      id: newId(),
      name: "Assembly line",
      isDefault: true,
      fields: [
        field("Station", "radio", {
          isRequired: true,
          sortOrder: 0,
          options: ["Station 1", "Station 2", "Station 3", "Station 4", "Station 5", "Rework"],
        }),
        field("Operation", "textInput", { isRequired: true, sortOrder: 1 }),
        field("Task type", "radio", {
          isRequired: true,
          sortOrder: 2,
          options: ["Value-added", "Walking", "Waiting", "Setup", "Inspection", "Rework"],
        }),
        field("Tools used", "checkbox", {
          isRequired: false,
          sortOrder: 3,
          options: ["Torque driver", "Hoist", "Scanner", "Hand tools", "None"],
          exclusiveOptions: ["None"],
        }),
        field("Interrupted", "boolean", { isRequired: false, sortOrder: 4 }),
        field("Notes", "textArea", { isRequired: false, sortOrder: 5 }),
      ],
    },
    {
      id: newId(),
      name: "Ward round",
      isDefault: false,
      fields: [
        field("Location", "radio", {
          isRequired: true,
          sortOrder: 0,
          options: ["Bed", "Nurses’ station", "Treatment room", "Corridor", "Office"],
        }),
        field("Activity", "textInput", { isRequired: true, sortOrder: 1 }),
        field("Care type", "radio", {
          isRequired: true,
          sortOrder: 2,
          options: ["Direct care", "Documentation", "Handover", "Medication", "Waiting", "Other"],
        }),
        field("Equipment used", "checkbox", {
          isRequired: false,
          sortOrder: 3,
          options: ["Trolley", "Computer on wheels", "Monitor", "Phone", "None"],
          exclusiveOptions: ["None"],
        }),
        field("Patient present", "boolean", { isRequired: false, sortOrder: 4 }),
        field("Notes", "textArea", { isRequired: false, sortOrder: 5 }),
      ],
    },
    {
      id: newId(),
      name: "Warehouse pick",
      isDefault: false,
      fields: [
        field("Zone", "radio", {
          isRequired: true,
          sortOrder: 0,
          options: ["A", "B", "C", "Packing", "Dock"],
        }),
        field("Order/task", "textInput", { isRequired: true, sortOrder: 1 }),
        field("Activity", "radio", {
          isRequired: true,
          sortOrder: 2,
          options: ["Walking", "Picking", "Scanning", "Packing", "Waiting", "Searching"],
        }),
        field("Aids used", "checkbox", {
          isRequired: false,
          sortOrder: 3,
          options: ["Handheld scanner", "Trolley", "Forklift", "Pick list", "None"],
          exclusiveOptions: ["None"],
        }),
        field("Item damaged", "boolean", { isRequired: false, sortOrder: 4 }),
        field("Notes", "textArea", { isRequired: false, sortOrder: 5 }),
      ],
    },
    {
      id: newId(),
      name: "Packing measurements",
      isDefault: false,
      fields: [
        field("Parcel weight (kg)", "number", { isRequired: true, sortOrder: 0 }),
        field("Items packed", "counter", { isRequired: true, sortOrder: 1 }),
        field("Effort (1 = easy, 5 = very hard)", "rating", { isRequired: true, sortOrder: 2 }),
        field("Quality check passed", "boolean", { isRequired: true, sortOrder: 3 }),
      ],
    },
  ];
};

/** Seeds the sample templates exactly once, when zero templates exist. */
export const EnsureTemplatesSeeded = Command.define("EnsureTemplatesSeeded", {
  messages: [Message.TemplatesSeededCheck, Message.FailedTemplateOp],
  execute: withStore(({ store, tables, events }) =>
    Effect.gen(function* () {
      const now = yield* DateTime.nowAsDate;
      const existing = store.query(tables.templates.select());
      if (existing.length > 0) return Message.TemplatesSeededCheck();
      const templates = yield* withRandomUuids(sampleTemplates);
      store.commit(events.templatesSeeded({ templates, now }));
      return Message.TemplatesSeededCheck();
    }),
  ).pipe(reportFailure("create", failedTemplateOp)),
});

/**
 * Adds the sample templates the user doesn't have yet, by name. Never changes
 * which template is the default unless the app has none at all.
 */
export const AddSampleTemplates = Command.define("AddSampleTemplates", {
  messages: [Message.SampleTemplatesAdded, Message.FailedTemplateOp],
  execute: withStore(({ store, tables, events }) =>
    Effect.gen(function* () {
      const now = yield* DateTime.nowAsDate;
      const existing = store.query(tables.templates.select());
      const taken = new Set(Array.map(existing, (t) => t.name));
      const samples = yield* withRandomUuids(sampleTemplates);
      const missing = pipe(
        samples,
        Array.filter((template) => !taken.has(template.name)),
        Array.map((template, index) => ({
          ...template,
          isDefault: existing.length === 0 && index === 0,
        })),
      );
      if (missing.length > 0) store.commit(events.templatesSeeded({ templates: missing, now }));
      return Message.SampleTemplatesAdded();
    }),
  ).pipe(reportFailure("create", failedTemplateOp)),
});
