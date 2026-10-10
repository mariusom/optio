import type { Html, HtmlBuilder } from "foldkit/html";

import { Check, Copy, List, icon } from "@/components/app";
import { button } from "@/components/ui/button";
import { Progress, progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { formatClock } from "../../format";
import { repeatPlan, type RepeatPlan } from "./repeatAnswers";
import {
  currentTask,
  isSectionDone,
  taskStartDate,
  type RunnerState,
  type RunnerTask,
} from "./runner";

// Live status pieces around the runner form: the header clock and task
// counter, required-answer progress, confirmations and "Repeat last answers".

// ── Header clock ────────────────────────────────────────────────────────────

/**
 * The live clock under the session name: a small task label and a large,
 * glanceable time. Not a live region: it would announce every second.
 */
export const sessionTimerView = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const task = currentTask(runner);
  const isEditing = task !== null && task.isBeingEdited;
  const taskStart = task === null ? null : taskStartDate(task);
  const isRecording = !isEditing && taskStart !== null;
  const elapsed = Math.max(0, runner.now - (taskStart ?? runner.startedAt));
  const label =
    task === null
      ? "Session"
      : isEditing
        ? `Editing task ${task.orderIndex}`
        : `Task ${task.orderIndex}`;

  return h.div(
    [h.Class("flex min-w-0 items-center justify-center gap-2"), h.DataAttribute("slot", "timer")],
    [
      h.span(
        [h.Class("flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground")],
        [
          h.span([
            h.Class(
              cn(
                "size-2 shrink-0 rounded-full",
                isEditing ? "bg-warning" : isRecording ? "bg-success animate-pulse" : "bg-border",
              ),
            ),
            h.AriaHidden(true),
          ]),
          label,
        ],
      ),
      ...(isEditing
        ? []
        : [
            h.span(
              [
                h.Class(
                  "text-2xl leading-tight font-semibold tracking-tight text-foreground tabular",
                ),
              ],
              [formatClock(elapsed)],
            ),
          ]),
    ],
  );
};

// ── Task counter ────────────────────────────────────────────────────────────

const tasksWord = (count: number) => (count === 1 ? "task" : "tasks");

/** Accessible name for the counter: starts with its visible "2 tasks". */
export const taskCountName = (runner: RunnerState, action: string) =>
  `${runner.completedCount} ${tasksWord(runner.completedCount)} recorded, ${action}`;

/**
 * "2 tasks" with a list icon. The number is re-keyed per count and briefly
 * scales in after a recording (static under reduced motion).
 */
export const taskCountLabel = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const count = runner.completedCount;
  const justRecorded = runner.announcement?.kind === "recorded";
  return h.span(
    [h.Class("flex items-center gap-1.5 text-sm font-medium")],
    [
      icon(h, List, "size-5 shrink-0"),
      // Inline text, so the visible label (and its accessible text) is "2 tasks".
      h.span(
        [],
        [
          h.keyed("span")(
            `task-count-${count}`,
            [
              h.Class(
                cn(
                  "inline-block tabular",
                  justRecorded &&
                    "text-success motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500",
                ),
              ),
              h.DataAttribute("slot", "task-count"),
            ],
            [`${count}`],
          ),
          " ",
          h.span([h.Class("max-[359px]:sr-only")], [tasksWord(count)]),
        ],
      ),
    ],
  );
};

// ── Action bar status ───────────────────────────────────────────────────────

/** "1 of 3 required answered", while a required answer is missing or invalid. */
export const requiredProgress = (task: RunnerTask, h: HtmlBuilder<Message>): Html | null => {
  const required = task.sections.filter((section) => section.isRequired);
  const answered = required.filter(isSectionDone).length;
  if (required.length === 0 || answered === required.length) return null;
  const text = `${answered} of ${required.length} required answered`;
  return progress(
    {
      value: (answered / required.length) * 100,
      // The muted track barely shows on the light background; keep it visible.
      className: "w-full gap-y-1.5 [&_[data-slot=progress-track]]:bg-foreground/10",
      attributes: [h.AriaLabel("Required answers"), h.AriaValuetext(text)],
      children: [Progress.label({ className: "text-muted-foreground tabular" }, [text], h)],
    },
    h,
  );
};

/**
 * The runner's polite status region. It is always rendered, so screen readers
 * already track it when a confirmation appears; empty, it takes no space.
 */
export const announcementView = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const announcement = runner.announcement;
  return h.p(
    [
      h.Role("status"),
      h.AriaLive("polite"),
      h.DataAttribute("slot", "runner-status"),
      h.Class(
        cn(
          "flex items-center justify-center gap-1.5 text-sm font-medium empty:sr-only",
          announcement?.kind === "recorded" ? "text-success" : "text-foreground",
        ),
      ),
    ],
    announcement === null ? [] : [icon(h, Check, "size-4 shrink-0"), announcement.text],
  );
};

// ── Repeat last answers ─────────────────────────────────────────────────────

const repeatHint = (plan: RepeatPlan): string => {
  if (plan.source === null) return "No earlier task to copy answers from yet.";
  const count = plan.writes.length;
  if (count === 0) return `Nothing left to fill from task ${plan.source.orderIndex}.`;
  return `Fills ${count} empty answer${count === 1 ? "" : "s"} from task ${plan.source.orderIndex}.`;
};

/** Shown above the questions of an open task; responsive copies scope the hint ID. */
export const repeatAnswersRow = (
  runner: RunnerState,
  scope: string,
  h: HtmlBuilder<Message>,
): Html | null => {
  const plan = repeatPlan(runner);
  if (plan === null) return null;
  const hintId = `${scope}-repeat-hint`;
  return h.div(
    [h.Class("flex flex-wrap items-center gap-x-3 gap-y-1.5")],
    [
      button(
        {
          variant: "outline",
          isDisabled: plan.writes.length === 0,
          onClick: Message.ClickedRepeatLastAnswers(),
          attributes: [h.AriaDescribedBy(hintId)],
        },
        [icon(h, Copy, "size-4"), "Repeat last answers"],
        h,
      ),
      h.p([h.Id(hintId), h.Class("min-w-0 text-sm text-muted-foreground")], [repeatHint(plan)]),
    ],
  );
};
