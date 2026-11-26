import { Array } from "effect";
import type { H, Ui } from "@/lib/view";

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
const stackedBar = (question: QuestionBreakdown, h: H<Message>): Ui =>
  h.div
    .class("flex h-2.5 w-full gap-0.5 overflow-hidden rounded-sm forced-color-adjust-none")
    .attr("aria-hidden", String(true))
    .children(
      Array.map(question.segments, (segment) =>
        h.span
          .key(segment.key)
          .class(`block h-full min-w-0.5 ${fillClass(segment)}`)
          .style({ flex: `${segment.durationMs} 1 0%` }),
      ),
    );

const legendItem = (segment: BreakdownSegment, h: H<Message>): Ui =>
  h.li
    .key(segment.key)
    .class("flex items-baseline gap-2 text-sm")
    .children(
      h.span
        .class(
          `size-2.5 shrink-0 self-center rounded-[2px] forced-color-adjust-none ${fillClass(segment)}`,
        )
        .attr("aria-hidden", String(true)),
      h.span
        .class(
          `min-w-0 flex-1 break-words ${segment.kind === "answer" ? "text-foreground" : "text-muted-foreground"}`,
        )
        .attr("dir", "auto")
        .children(segment.label),
      h.span
        .class("shrink-0 text-right tabular text-muted-foreground")
        .children(`${formatDurationHms(segment.durationMs)} · ${formatShare(segment)}`),
    );

const questionBlock = (question: QuestionBreakdown, h: H<Message>): Ui =>
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
      stackedBar(question, h),
      h.ul
        .class("flex flex-col gap-1.5")
        .attr("aria-label", `Time by answer to ${question.question}`)
        .children(Array.map(question.segments, (segment) => legendItem(segment, h))),
    );

type BreakdownTasks = Parameters<typeof timeBreakdown>[0];

/** "Where did the time go?" — nothing when no choice question was answered. */
export const timeBreakdownSection = (tasks: BreakdownTasks, h: H<Message>): Ui | null => {
  const breakdown = timeBreakdown(tasks);
  if (breakdown.length === 0) return null;
  return groupedList(
    {
      header: "Time breakdown",
      footer: "Task time by answer to each single-choice and yes/no question.",
    },
    Array.map(breakdown, (question) => questionBlock(question, h)),
    h,
  );
};
