import type { Stream } from "effect";
import { storeStream } from "./managedStream";
import { Message } from "../messages";
import { fieldRowsToDefs } from "../web/fieldRows";
import { groupSectionsByRecord } from "../web/features/history/helpers";
import type { TaskSectionRow } from "../livestore/queries";

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

type ReportRecord = Readonly<{ id: string; startedAt: Date | null; endedAt: Date | null }>;

const toReportSection = (section: TaskSectionRow) => ({
  sectionName: section.sectionName,
  value: section.value,
  sectionType: section.sectionType,
});

/** One archived task with its answers, as the breakdown helper reads them. */
const toReportTask =
  (sectionsByRecord: ReadonlyMap<string, ReadonlyArray<TaskSectionRow>>) =>
  (record: ReportRecord) => ({
    startedAt: record.startedAt?.getTime() ?? null,
    endedAt: record.endedAt?.getTime() ?? null,
    sections: (sectionsByRecord.get(record.id) ?? []).map(toReportSection),
  });

/** Every finished session of one template, for its time report. */
export const templateReportStream = (templateId: string): Stream.Stream<Message> =>
  storeStream(Message.StoreUnavailable(), ({ store, queries }, emit) => [
    store.subscribe(queries.templateReportRows(templateId), ({ summary, records, sections }) =>
      emit(
        Message.GotTemplateReport({
          report: {
            templateId,
            sessionCount: summary.sessionCount,
            totalMs: summary.totalMs,
            tasks: records.map(toReportTask(groupSectionsByRecord(sections))),
          },
        }),
      ),
    ),
  ]);
