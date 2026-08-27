import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { getStore } from "../../../livestore/client";
import { events, tables, type FieldDef } from "../../../livestore/schema";
import { fieldRowsToDefs } from "../../fieldRows";
import { nextDuplicateName } from "./naming";

// Commands for the Templates tab. Each awaits the store handle (FoldKit has
// no store hook), commits events, and reports back through a message.

export const CreateTemplate = Command.define("CreateTemplate", {
  args: { id: S.String, name: S.String },
  messages: [Message.TemplateCreated],
  execute: ({ id, name }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      // First template ever becomes the default automatically
      const existing = store.query(tables.templates.select()) as ReadonlyArray<{ id: string }>;
      store.commit(events.templateCreated({ id, name, isDefault: existing.length === 0 }));
      return Message.TemplateCreated();
    }),
});

export const SetDefaultTemplate = Command.define("SetDefaultTemplate", {
  args: { id: S.String },
  messages: [Message.TemplateOpDone],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      store.commit(events.templateDefaultSet({ id }));
      return Message.TemplateOpDone();
    }),
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
      if (source === undefined)
        return yield* effectFailure("Failed to duplicate template. Please try again.");
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
        events.templateCreated({ id: copyId, name: copyName, isDefault: false }),
        events.fieldsReplaced({ templateId: copyId, fields }),
      );
      return Message.DuplicatedTemplate({ id: copyId });
    }).pipe(
      Effect.catch((error) => Effect.succeed(Message.FailedTemplateOp({ error: String(error) }))),
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
      Effect.catch((error) => Effect.succeed(Message.FailedTemplateOp({ error: String(error) }))),
    ),
});

/** Seeds "Sample Study" exactly once, when zero templates exist (spec §1.10). */
export const EnsureTemplatesSeeded = Command.define("EnsureTemplatesSeeded", {
  args: {},
  messages: [Message.TemplatesSeededCheck],
  execute: () =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const existing = store.query(tables.templates.select()) as ReadonlyArray<{ id: string }>;
      if (existing.length > 0) return Message.TemplatesSeededCheck();

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

      store.commit(
        events.templatesSeeded({
          templates: [
            {
              id: crypto.randomUUID(),
              name: "Sample Study",
              isDefault: true,
              fields: [
                field("Activity", "textInput", true, 0),
                field("Category", "radio", true, 1, [
                  "Communication",
                  "Documentation",
                  "Direct task",
                  "Admin",
                  "Other",
                ]),
                field(
                  "Tools used",
                  "checkbox",
                  true,
                  2,
                  ["Computer", "Phone", "Paper", "Reference material", "None"],
                  ["None"],
                ),
                field("Interrupted", "boolean", false, 3),
                field("Notes", "textArea", false, 4),
              ],
            },
          ],
        }),
      );
      return Message.TemplatesSeededCheck();
    }).pipe(Effect.catch((_error) => Effect.succeed(Message.TemplatesSeededCheck()))),
});

const effectFailure = (message: string) => Effect.fail(new Error(message));
