import type { Stream } from "effect";
import { storeStream } from "./managedStream";
import { Message } from "../messages";
import { fieldRowsToDefs } from "../web/fieldRows";

export const templatesStream: Stream.Stream<Message> = storeStream(
  Message.StoreUnavailable(),
  ({ store, queries }, emit) => [
    store.subscribe(queries.templateSummaries, (rows) =>
      emit(
        Message.GotTemplates({
          templates: rows
            .map((row) => ({ ...row, isDefault: row.isDefault === 1 }))
            .toSorted((a, b) => a.name.localeCompare(b.name)),
        }),
      ),
    ),
  ],
);

export const templateDetailStream = (templateId: string): Stream.Stream<Message> =>
  storeStream(Message.StoreUnavailable(), ({ store, queries }, emit) => [
    store.subscribe(queries.templateRows(templateId), ({ template, fields }) =>
      emit(
        Message.GotTemplateDetail({
          template:
            template === null
              ? null
              : {
                  id: template.id,
                  name: template.name,
                  isDefault: template.isDefault === 1,
                  // Fields arrive ordered by sortOrder.
                  fields: [...fieldRowsToDefs(fields)],
                },
        }),
      ),
    ),
  ]);
