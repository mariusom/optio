import { Clock, Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { reportFailure } from "../../errors";
import { withStore } from "../../../livestore/access";
import { FieldDef } from "../../../domain/fields";

export const SaveTemplate = Command.define("SaveTemplate", {
  args: {
    id: S.String,
    name: S.String,
    isDefault: S.Boolean,
    isNew: S.optionalKey(S.Boolean),
    fields: S.Array(FieldDef),
  },
  messages: [Message.TemplateSaved, Message.FailedTemplateOp],
  execute: ({ id, name, isDefault, fields, isNew }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const now = new Date(yield* Clock.currentTimeMillis);
        const trimmedName = name.trim();
        const dense = fields.map((field, index) => ({
          ...field,
          name: field.name.trim(),
          sortOrder: index,
        }));
        if (isNew) {
          const first = store.query(tables.templates.select()).length === 0;
          // Creation does not clear other defaults; TemplateDefaultSet does.
          store.commit(
            events.templateCreated({ id, name: trimmedName, isDefault: isDefault || first, now }),
            events.fieldsReplaced({ templateId: id, fields: dense }),
            ...(isDefault || first ? [events.templateDefaultSet({ id })] : []),
          );
        } else {
          // TemplateUpdated clears other defaults when this one becomes default.
          store.commit(
            events.templateUpdated({ id, name: trimmedName, isDefault, fields: dense, now }),
          );
        }
        return Message.TemplateSaved();
      }),
    ).pipe(reportFailure("save", (error) => Message.FailedTemplateOp({ error }))),
});
