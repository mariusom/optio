import { Effect, Queue, Stream } from "effect";
import { managedStream } from "./managedStream";
import { Message } from "../messages";
import { getStore } from "../livestore/client";
import { tables } from "../livestore/schema";
import type { FieldDef } from "../livestore/schema";
import { safeArray } from "../web/fieldRows";

type TemplateRow = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};
type FieldRow = { readonly templateId: string; readonly isRequired: number };

const toFieldRow = (row: FieldRow): FieldRow => ({
  templateId: row.templateId,
  isRequired: row.isRequired,
});

const buildSummaries = (
  templateRows: ReadonlyArray<TemplateRow>,
  fieldRows: ReadonlyArray<FieldRow>,
) => {
  const counts = new Map<string, { count: number; required: number }>();
  for (const row of fieldRows) {
    const entry = counts.get(row.templateId) ?? { count: 0, required: 0 };
    counts.set(row.templateId, {
      count: entry.count + 1,
      required: entry.required + (row.isRequired === 1 ? 1 : 0),
    });
  }
  return [...templateRows]
    .map((row) => {
      const c = counts.get(row.id) ?? { count: 0, required: 0 };
      return {
        id: row.id,
        name: row.name,
        isDefault: row.isDefault === 1,
        createdAt: Number(row.createdAt),
        updatedAt: Number(row.updatedAt),
        fieldCount: c.count,
        requiredCount: c.required,
      };
    })
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

export const templatesStream: Stream.Stream<Message> = managedStream((queue) =>
  Effect.promise(async () => {
    const store = await getStore();
    let latestTemplates: ReadonlyArray<TemplateRow> = [];
    let latestFields: ReadonlyArray<FieldRow> = [];
    const push = () =>
      Queue.offerUnsafe(
        queue,
        Message.GotTemplates({ templates: buildSummaries(latestTemplates, latestFields) }),
      );
    const unsubscribeTemplates = store.subscribe(
      tables.templates.select().orderBy("name", "asc"),
      (rows) => {
        latestTemplates = rows as unknown as ReadonlyArray<TemplateRow>;
        push();
      },
    );
    const unsubscribeFields = store.subscribe(tables.templateFields.select(), (rows) => {
      latestFields = (rows as unknown as Array<FieldRow>).map(toFieldRow);
      push();
    });
    return [unsubscribeTemplates, unsubscribeFields] as const;
  }),
);

type DetailTemplateRow = {
  readonly id: string;
  readonly name: string;
  readonly isDefault: number;
};

type DetailFieldRow = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: number;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly optionsJson: string;
  readonly exclusiveOptionsJson: string;
};

export const templateDetailStream = (templateId: string): Stream.Stream<Message> =>
  managedStream((queue) =>
    Effect.promise(async () => {
      const store = await getStore();
      let templateLoaded = false;
      let latestTemplate: DetailTemplateRow | null = null;
      let latestFields: ReadonlyArray<DetailFieldRow> = [];

      const push = () => {
        if (!templateLoaded) return;
        if (latestTemplate === null) {
          Queue.offerUnsafe(queue, Message.GotTemplateDetail({ template: null }));
          return;
        }
        const fields = [...latestFields]
          .toSorted((a, b) => a.sortOrder - b.sortOrder)
          .map((row) => ({
            id: row.id,
            name: row.name,
            kind: row.kind as FieldDef["kind"],
            isRequired: row.isRequired === 1,
            defaultValue: row.defaultValue,
            sortOrder: row.sortOrder,
            options: safeArray(row.optionsJson),
            exclusiveOptions: safeArray(row.exclusiveOptionsJson),
          }));
        Queue.offerUnsafe(
          queue,
          Message.GotTemplateDetail({
            template: {
              id: latestTemplate.id,
              name: latestTemplate.name,
              isDefault: latestTemplate.isDefault === 1,
              fields,
            },
          }),
        );
      };

      const unsubscribeTemplate = store.subscribe(
        tables.templates.select().where({ id: templateId }),
        (rows) => {
          const first = (rows as unknown as ReadonlyArray<DetailTemplateRow>)[0] ?? null;
          latestTemplate = first;
          templateLoaded = true;
          push();
        },
      );

      const unsubscribeFields = store.subscribe(
        tables.templateFields.select().where({ templateId }).orderBy("sortOrder", "asc"),
        (rows) => {
          latestFields = rows as unknown as ReadonlyArray<DetailFieldRow>;
          push();
        },
      );

      return [unsubscribeTemplate, unsubscribeFields] as const;
    }),
  );
