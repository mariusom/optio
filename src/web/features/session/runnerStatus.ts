import { Array } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Check, List, icon } from "@/components/app";
import { progress, progressLabel } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { formatClock } from "../../format";
import {
  currentTask,
  isSectionDone,
  taskStartDate,
  type RunnerState,
  type RunnerTask,
} from "./runner";

// Live status pieces around the runner form: the header clock and task
// counter, required-answer progress, and confirmations.

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
  // A task's time starts at its first answer, so an untouched task reads 00:00
  // rather than the session's time; with no task, the clock shows the session.
  const elapsed =
    task === null
      ? Math.max(0, runner.now - runner.startedAt)
      : taskStart === null
        ? 0
        : Math.max(0, runner.now - taskStart);
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

/** Required-answer progress stays visible at completion to keep the footer steady. */
export const requiredProgress = (
  task: RunnerTask,
  scope: string,
  h: HtmlBuilder<Message>,
): Html | null => {
  const required = Array.filter(task.sections, (section) => section.isRequired);
  const answered = Array.filter(required, isSectionDone).length;
  if (required.length === 0) return null;
  const text = `${answered} of ${required.length} required answered`;
  return progress(
    {
      id: `${scope}-required-answer-progress`,
      value: (answered / required.length) * 100,
      // The muted track barely shows on the light background; keep it visible.
      className:
        "w-full flex-nowrap items-center [&>[data-slot=progress-track]]:h-1.5 [&>[data-slot=progress-track]]:min-w-8 [&>[data-slot=progress-track]]:flex-1 [&>[data-slot=progress-track]]:bg-foreground/15",
      ariaLabel: "Required answers",
      valueText: text,
      segments: required.length > 1 && required.length <= 8 ? required.length : undefined,
      children: [
        progressLabel(
          // Bars lead, the count trails; only the visual order changes, so it is still read first.
          {
            className: "order-last shrink-0 text-muted-foreground tabular",
            id: `${scope}-required-answer-label`,
          },
          [text],
          h,
        ),
      ],
    },
    h,
  );
};

/**
 * The runner's polite status region. It is always rendered, so screen readers
 * already track it when a confirmation appears; empty, it takes no space.
 */
export const announcementView = (
  announcement: RunnerState["announcement"],
  isVisible: boolean,
  h: HtmlBuilder<Message>,
) =>
  h.p(
    [
      h.Role("status"),
      h.AriaLive("polite"),
      h.DataAttribute("slot", "runner-status"),
      h.Class(
        cn(
          "flex items-center justify-center gap-1.5 text-sm font-medium empty:sr-only",
          announcement?.kind === "recorded" ? "text-success" : "text-foreground",
          !isVisible && "sr-only",
        ),
      ),
    ],
    announcement === null ? [] : [icon(h, Check, "size-4 shrink-0"), announcement.text],
  );
