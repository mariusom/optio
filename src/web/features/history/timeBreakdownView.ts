import type { Html, HtmlBuilder } from "foldkit/html";

import { groupedList } from "@/components/app";
import { Message } from "../../../messages";
import { formatDurationHms } from "../../format";
import {
  formatShare,
  type BreakdownSegment,
  type QuestionBreakdown,
  timeBreakdown,
} from "./timeBreakdown";

/**
 * Categorical slots in fixed order, each with its own dark-mode step. The
 * order is the colour-blind safety mechanism for neighbouring segments
 * (checked with the dataviz palette validator against the card surface in
 * both modes); light slots 3–5 fall under 3:1, so every segment is also named
 * with its values in the list below the bar.
 */
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

/** Decorative: the list below carries the same data for every reader. */
const stackedBar = (question: QuestionBreakdown, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class("flex h-2.5 w-full gap-0.5 overflow-hidden rounded-sm forced-color-adjust-none"),
      h.AriaHidden(true),
    ],
    question.segments.map((segment) =>
      h.keyed("span")(segment.key, [
        h.Class(`block h-full min-w-0.5 ${fillClass(segment)}`),
        h.Style({ flex: `${segment.durationMs} 1 0%` }),
      ]),
    ),
  );

const legendItem = (segment: BreakdownSegment, h: HtmlBuilder<Message>): Html =>
  h.keyed("li")(
    segment.key,
    [h.Class("flex items-baseline gap-2 text-sm")],
    [
      h.span([
        h.Class(
          `size-2.5 shrink-0 self-center rounded-[2px] forced-color-adjust-none ${fillClass(segment)}`,
        ),
        h.AriaHidden(true),
      ]),
      h.span(
        [
          h.Class(
            `min-w-0 flex-1 break-words ${segment.kind === "answer" ? "text-foreground" : "text-muted-foreground"}`,
          ),
        ],
        [segment.label],
      ),
      h.span(
        [h.Class("shrink-0 text-right tabular text-muted-foreground")],
        [`${formatDurationHms(segment.durationMs)} · ${formatShare(segment)}`],
      ),
    ],
  );

const questionBlock = (question: QuestionBreakdown, h: HtmlBuilder<Message>): Html =>
  h.keyed("div")(
    question.key,
    [h.Class("flex flex-col gap-3 px-4 py-3")],
    [
      h.h3(
        [h.Class("flex items-baseline gap-2 text-sm font-medium text-foreground")],
        [
          h.span([h.Class("min-w-0 flex-1 break-words")], [question.question]),
          h.span(
            [h.Class("shrink-0 font-normal tabular text-muted-foreground")],
            [formatDurationHms(question.totalMs)],
          ),
        ],
      ),
      stackedBar(question, h),
      h.ul(
        [h.Class("flex flex-col gap-1.5"), h.AriaLabel(`Time by answer to ${question.question}`)],
        question.segments.map((segment) => legendItem(segment, h)),
      ),
    ],
  );

type BreakdownTasks = Parameters<typeof timeBreakdown>[0];

/** "Where did the time go?" — nothing when no choice question was answered. */
export const timeBreakdownSection = (
  tasks: BreakdownTasks,
  h: HtmlBuilder<Message>,
): Html | null => {
  const breakdown = timeBreakdown(tasks);
  if (breakdown.length === 0) return null;
  return groupedList(
    {
      header: "Time breakdown",
      footer: "Task time by answer to each single-choice and yes/no question.",
    },
    breakdown.map((question) => questionBlock(question, h)),
    h,
  );
};
