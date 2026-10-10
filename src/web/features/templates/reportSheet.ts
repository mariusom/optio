import type { Html, HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import { formatDurationShort } from "../../format";
import { sheet } from "../../sheets";
import type { TemplateReport, TemplateSummary } from "../../types";
import { taskCountLabel } from "../history/helpers";
import { timeBreakdownSection } from "../history/timeBreakdownView";

// "Where does the time go with this template?" — the session-detail time
// breakdown, summed over every finished session recorded with one template.

const sessionsLabel = (count: number) => `${count} session${count === 1 ? "" : "s"}`;

const note = (text: string, h: HtmlBuilder<Message>): Html =>
  h.p([h.Class("text-sm text-muted-foreground")], [text]);

const reportBody = (report: TemplateReport | "failed" | null, h: HtmlBuilder<Message>): Html => {
  if (report === "failed") {
    return h.p(
      [h.Role("alert"), h.Class("text-sm text-destructive")],
      ["Couldn't load the report right now. Close it and try again."],
    );
  }
  if (report === null) {
    return h.p([h.Role("status"), h.Class("text-sm text-muted-foreground")], ["Loading report…"]);
  }
  if (report.sessionCount === 0) {
    return note(
      "No finished sessions yet. End a session recorded with it to see where the time goes.",
      h,
    );
  }
  const breakdown = timeBreakdownSection(report.tasks, h);
  return h.div(
    [h.Class("flex flex-col gap-4")],
    [
      h.p(
        [
          h.Class("text-sm font-medium text-foreground tabular"),
          h.DataAttribute("slot", "report-totals"),
        ],
        [
          [
            sessionsLabel(report.sessionCount),
            taskCountLabel(report.tasks.length),
            formatDurationShort(report.totalMs),
          ].join(" · "),
        ],
      ),
      breakdown ?? note("No single-choice or yes/no answers to break down yet.", h),
    ],
  );
};

/** Opened from the template action sheet; data follows `templateReportFor`. */
export const templateReportSheet = (
  template: TemplateSummary,
  report: TemplateReport | "failed" | null,
  h: HtmlBuilder<Message>,
): Html =>
  sheet(
    {
      id: "template-report",
      title: `${template.name}: time report`,
      description: "Every finished session recorded with this template.",
      onDismiss: Message.ClosedTemplateReport(),
      footer: { cancel: { label: "Close", onClick: Message.ClosedTemplateReport() } },
    },
    [reportBody(report === "failed" || report?.templateId === template.id ? report : null, h)],
    h,
  );
