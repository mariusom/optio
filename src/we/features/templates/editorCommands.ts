import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { friendlyFailure } from "../../errors";
import { getStore } from "../../../livestore/client";
import { events, tables, type FieldDef } from "../../../livestore/schema";

export const SaveTemplate = Command.define("SaveTemplate", {
  args: {
    id: S.String,
    name: S.String,
    isDefault: S.Boolean,
    isNew: S.optionalKey(S.Boolean),
    fields: S.Array(
      S.Struct({
        id: S.String,
        name: S.String,
        kind: S.Literals(["radio", "checkbox", "textInput", "textArea", "boolean"]),
        isRequired: S.Boolean,
        defaultValue: S.String,
        sortOrder: S.Number,
        options: S.Array(S.String),
        exclusiveOptions: S.Array(S.String),
      }),
    ),
  },
  messages: [Message.TemplateSaved, Message.FailedTemplateOp],
  execute: ({ id, name, isDefault, fields, isNew }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const trimmedName = name.trim();
      const dense: ReadonlyArray<FieldDef> = (fields as ReadonlyArray<FieldDef>).map(
        (field, index) => ({
          ...field,
          name: field.name.trim(),
          sortOrder: index,
        }),
      );
      if (isNew) {
        const first = store.query(tables.templates.select()).length === 0;
        store.commit(
          events.templateCreated({ id, name: trimmedName, isDefault: isDefault || first }),
          events.fieldsReplaced({ templateId: id, fields: dense }),
          ...(isDefault || first ? [events.templateDefaultSet({ id })] : []),
        );
      } else if (isDefault) {
        store.commit(
          events.templateUpdated({ id, name: trimmedName, isDefault, fields: dense }),
          events.templateDefaultSet({ id }),
        );
      } else {
        store.commit(events.templateUpdated({ id, name: trimmedName, isDefault, fields: dense }));
      }
      return Message.TemplateSaved();
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.succeed(Message.FailedTemplateOp({ error: friendlyFailure("save", cause) })),
      ),
    ),
});
