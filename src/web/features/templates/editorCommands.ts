import { Array, DateTime, Effect, Schema, String } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { reportFailure } from "../../errors";
import { withStore } from "../../../livestore/access";
import { FieldDef } from "../../../domain/fields";

export const SaveTemplate = Command.define("SaveTemplate", {
  args: {
    id: Schema.String,
    name: Schema.String,
    isDefault: Schema.Boolean,
    isNew: Schema.optionalKey(Schema.Boolean),
    fields: Schema.Array(FieldDef),
  },
  messages: [Message.TemplateSaved, Message.FailedTemplateOp],
  execute: ({ id, name, isDefault, fields, isNew }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const now = yield* DateTime.nowAsDate;
        const trimmedName = String.trim(name);
        const dense = Array.map(fields, (field, index) => ({
          ...field,
          name: String.trim(field.name),
          sortOrder: index,
        }));
        if (isNew === true) {
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
