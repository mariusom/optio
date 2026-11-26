import { Array, pipe, String, type Stream } from "effect";
import { storeStream } from "./managedStream";
import { Message } from "../messages";
import { fieldRowsToDefs } from "../web/fieldRows";
import { groupSectionsByRecord } from "../web/features/history/helpers";
import type { TaskSectionRow } from "../store/queries";
import type { TemplateReport } from "../web/types";

export const templatesStream: Stream.Stream<Message> = storeStream(
  Message.StoreUnavailable(),
  ({ store, queries }, emit) => [
    store.subscribe(queries.templateSummaries, (rows) =>
      emit(
        Message.GotTemplates({
          templates: Array.sort(
            Array.map(rows, (row) => ({ ...row, isDefault: row.isDefault === 1 })),
            (a: { readonly name: string }, b: { readonly name: string }) =>
              pipe(a.name, String.localeCompare(b.name)),
          ),
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
    sections: Array.map(sectionsByRecord.get(record.id) ?? [], toReportSection),
  });

/**
 * Every finished session of one template, for its time report, as the caller's
 * messages: the app's and the standalone ReportBody component's.
 */
export const templateReports = <M>(
  templateId: string,
  messages: Readonly<{ unavailable: M; loaded: (report: TemplateReport) => M }>,
): Stream.Stream<M> =>
  storeStream(messages.unavailable, ({ store, queries }, emit) => [
    store.subscribe(queries.templateReportRows(templateId), ({ summary, records, sections }) =>
      emit(
        messages.loaded({
          templateId,
          sessionCount: summary.sessionCount,
          totalMs: summary.totalMs,
          tasks: Array.map(records, toReportTask(groupSectionsByRecord(sections))),
        }),
      ),
    ),
  ]);

export const templateReportStream = (templateId: string): Stream.Stream<Message> =>
  templateReports<Message>(templateId, {
    unavailable: Message.StoreUnavailable(),
    loaded: (report) => Message.GotTemplateReport({ report }),
  });
