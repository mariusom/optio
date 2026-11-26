// Standalone Effect UI component for the template time report body
// (reportSheet.ts renders the same report from the root Model). It owns its data: the report and read failure live in its
// own Model, fed by its own Subscription, instead of the root Model. The sheet
// frame and its open state (`templateReportFor`) stay with the page.
// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview; every API here is experimental.
import { Subscription, UiSchema } from "@effect/ui";
import { Html } from "@effect/ui/html";
import { Array, Cause, Effect, Schema, Stream } from "effect";

import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { templateReports } from "../../../app/templateStreams";
import { formatDurationHms, formatDurationShort } from "../../format";
import { TemplateReport } from "../../types";
import { taskCountLabel } from "../history/helpers";
import {
  formatShare,
  timeBreakdown,
  type BreakdownSegment,
  type QuestionBreakdown,
} from "../history/timeBreakdown";

export const ReportBodyMessage = UiSchema.TaggedEnum({
  ChangedReport: { report: TemplateReport },
  FailedReport: {},
});

const ReportBodyDef = Html.component({
  name: "ReportBody",
  props: Schema.Struct({ templateId: Schema.String }),
  model: Schema.Struct({
    report: Schema.NullOr(TemplateReport),
    failed: Schema.Boolean,
  }),
  message: ReportBodyMessage,
});

// A store that cannot open counts as a failed read: the root's storage notice
// explains why, and the report recovers when the store opens.
const reportMessages = (templateId: string) =>
  templateReports<typeof ReportBodyMessage.Type>(templateId, {
    unavailable: ReportBodyMessage.FailedReport(),
    loaded: (report) => ReportBodyMessage.ChangedReport({ report }),
  }).pipe(
    Stream.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Stream.empty
        : Stream.fromEffect(
            Effect.logError("Optio could not read this template's report.", cause).pipe(
              Effect.as(ReportBodyMessage.FailedReport()),
            ),
          ),
    ),
  );

// ── Time breakdown (port of history/timeBreakdownView.ts) ──────────────────

// Same fixed categorical slots as timeBreakdownView.ts; see its notes.
const slotClasses = [
  "bg-[#2a78d6] dark:bg-[#3987e5]",
  "bg-[#eb6834] dark:bg-[#d95926]",
  "bg-[#1baf7a] dark:bg-[#199e70]",
  "bg-[#eda100] dark:bg-[#c98500]",
  "bg-[#e87ba4] dark:bg-[#d55181]",
  "bg-[#008300] dark:bg-[#008300]",
] as const;

const unansweredClass = "bg-muted-foreground/40";

const fillClass = (segment: BreakdownSegment): string =>
  segment.slot === null ? unansweredClass : (slotClasses[segment.slot] ?? unansweredClass);

const QuestionBlock = <M>(h: Html.H<M>, question: QuestionBreakdown) =>
  h.div
    .key(question.key)
    .class("flex flex-col gap-3 px-4 py-3")
    .children(
      h.h3
        .class("flex items-baseline gap-2 text-sm font-medium text-foreground")
        .children(
          h.span
            .class("min-w-0 flex-1 break-words")
            .attr("dir", "auto")
            .children(question.question),
          h.span
            .class("shrink-0 font-normal tabular text-muted-foreground")
            .children(formatDurationHms(question.totalMs)),
        ),
      // Decorative: the list below carries the same data for every reader.
      h.div
        .class("flex h-2.5 w-full gap-0.5 overflow-hidden rounded-sm forced-color-adjust-none")
        .attr("aria-hidden", "true")
        .children(
          Array.map(question.segments, (segment) =>
            h.span
              .key(segment.key)
              .class(`block h-full min-w-0.5 ${fillClass(segment)}`)
              .style({ flex: `${segment.durationMs} 1 0%` }),
          ),
        ),
      h.ul
        .class("flex flex-col gap-1.5")
        .attr("aria-label", `Time by answer to ${question.question}`)
        .children(
          Array.map(question.segments, (segment) =>
            h.li
              .key(segment.key)
              .class("flex items-baseline gap-2 text-sm")
              .children(
                h.span
                  .class(
                    `size-2.5 shrink-0 self-center rounded-[2px] forced-color-adjust-none ${fillClass(segment)}`,
                  )
                  .attr("aria-hidden", "true"),
                h.span
                  .class(
                    `min-w-0 flex-1 break-words ${segment.kind === "answer" ? "text-foreground" : "text-muted-foreground"}`,
                  )
                  .attr("dir", "auto")
                  .children(segment.label),
                h.span
                  .class("shrink-0 text-right tabular text-muted-foreground")
                  .children(`${formatDurationHms(segment.durationMs)} · ${formatShare(segment)}`),
              ),
          ),
        ),
    );

/** "Where did the time go?" — `null` when no choice question was answered. */
const TimeBreakdownSection = <M>(h: Html.H<M>, tasks: TemplateReport["tasks"]) => {
  const breakdown = timeBreakdown(tasks);
  if (breakdown.length === 0) return null;
  // The markup of the app's `groupedList` with a card surface.
  return h.section.class("flex flex-col").children(
    h.h2
      .class(cn("pb-2 text-sm font-medium text-foreground"))
      .attr("data-slot", "section-header")
      .children("Time breakdown"),
    h.div
      .class(cn(cardClass, "gap-0 py-0 divide-y divide-border"))
      .attr("data-slot", "grouped-list")
      .attr("data-surface", "card")
      .children(Array.map(breakdown, (question) => QuestionBlock(h, question))),
    h.p
      .class("pt-2 text-sm leading-relaxed text-muted-foreground")
      .children("Task time by answer to each single-choice and yes/no question."),
  );
};

// ── Component ──────────────────────────────────────────────────────────────

const sessionsLabel = (count: number) => `${count} session${count === 1 ? "" : "s"}`;

export const ReportBody = ReportBodyDef.make({
  init: () => ({ report: null, failed: false }),
  update: {
    ChangedReport: ($, { report }) => $.evolve({ report, failed: false }),
    FailedReport: ($) => $.evolve({ failed: true }),
  },
  // Keyed on the template: a new templateId closes the old stream first.
  subscriptions: ({ props }) => [
    Subscription.make("report", props.templateId, (templateId) => reportMessages(templateId)),
  ],
  view: (h, model) => {
    const note = (text: string) => h.p.class("text-sm text-muted-foreground").children(text);
    if (model.failed) {
      return h.p
        .attr("role", "alert")
        .class("text-sm text-destructive")
        .children("Couldn't load the report right now. Close it and try again.");
    }
    // Until the new template's first emission, an earlier template's report is
    // not this one's.
    const report = model.report?.templateId === h.props.templateId ? model.report : null;
    if (report === null) {
      return h.p
        .attr("role", "status")
        .class("text-sm text-muted-foreground")
        .children("Loading report…");
    }
    if (report.sessionCount === 0) {
      return note(
        "No finished sessions yet. End a session recorded with it to see where the time goes.",
      );
    }
    return h.div.class("flex flex-col gap-4").children(
      h.p
        .class("text-sm font-medium text-foreground tabular")
        .attr("data-slot", "report-totals")
        .children(
          Array.join(
            [
              sessionsLabel(report.sessionCount),
              taskCountLabel(report.tasks.length),
              formatDurationShort(report.totalMs),
            ],
            " · ",
          ),
        ),
      TimeBreakdownSection(h, report.tasks) ??
        note("No single-choice or yes/no answers to break down yet."),
    );
  },
});
