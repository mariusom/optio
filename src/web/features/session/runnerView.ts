import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Check,
  List,
  Timer,
  actionGroup,
  confirmSheet,
  emptyState,
  groupedList,
  hint,
  icon,
  navBarAction,
  notice,
  row,
  sheet,
  statusPill,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { formatClock, formatDurationHms, formatTimeOnly } from "../../format";
import { isBooleanTrue } from "../../fields";
import { formSectionsView } from "./questionControls";
import {
  canRecordTask,
  currentTask,
  isSectionDone,
  isTaskDone,
  taskStartDate,
  type RunnerState,
  type RunnerTask,
} from "./runner";

// ── Status line ─────────────────────────────────────────────────────────────

/** Compact live status under the title: "Task 4 · 00:42". */
export const sessionTimerView = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const task = currentTask(runner);
  const isEditing = task !== null && task.isBeingEdited;
  const taskStart = task === null ? null : taskStartDate(task);
  const isRecording = !isEditing && taskStart !== null;
  const elapsed =
    taskStart !== null
      ? Math.max(0, runner.now - taskStart)
      : Math.max(0, runner.now - runner.startedAt);
  const parts =
    task === null
      ? [formatClock(elapsed)]
      : isEditing
        ? [`Editing task ${task.orderIndex}`]
        : [`Task ${task.orderIndex}`, formatClock(elapsed)];

  return h.p(
    [h.Class("flex items-center gap-1.5 text-xs text-muted-foreground tabular")],
    [
      h.span(
        [
          h.Class(
            cn(
              "size-1.5 shrink-0 rounded-full",
              isEditing ? "bg-warning" : isRecording ? "bg-success animate-pulse" : "bg-border",
            ),
          ),
          h.AriaHidden(true),
        ],
        [],
      ),
      h.span([], [parts.join(" · ")]),
    ],
  );
};

export { formSectionsView } from "./questionControls";

/** Scrolling form area; identical on phone, tablet and desktop. */
export const runnerCanvas = (
  options: Readonly<{ task: RunnerTask; scope: string }>,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class("min-h-0 flex-1 overflow-y-auto overscroll-y-contain")],
    [formSectionsView(options.task, h, options.scope)],
  );

// ── Nav bar pieces ──────────────────────────────────────────────────────────

const endAction = (h: HtmlBuilder<Message>) =>
  button(
    {
      onClick: Message.ClickedEndSession(),
      className:
        "bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300",
      attributes: [h.AriaLabel("End session")],
    },
    "End",
    h,
  );

const taskListAction = (runner: RunnerState, h: HtmlBuilder<Message>) =>
  navBarAction(
    {
      label: h.span(
        [h.Class("flex items-center gap-1.5")],
        [icon(h, List, "size-5"), h.span([h.Class("tabular")], [`${runner.completedCount}`])],
      ),
      onClick: Message.ToggledTaskList(),
      ariaLabel: "Show task list",
    },
    h,
  );

export const runnerNavBar = (
  runner: RunnerState,
  leading: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
) =>
  h.header(
    [
      h.Class(
        "sticky top-0 z-20 shrink-0 border-b border-border/70 bg-background pt-safe select-none",
      ),
      h.DataAttribute("slot", "nav-bar"),
    ],
    [
      h.div(
        [
          h.Class(
            "grid min-h-16 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-3 px-safe py-2",
          ),
        ],
        [
          h.div([h.Class("flex items-center justify-start")], leading),
          h.div(
            [h.Class("min-w-0 text-center")],
            [
              h.h1(
                [h.Class("truncate text-base font-semibold tracking-tight")],
                [runner.sessionName === "" ? runner.templateName : runner.sessionName],
              ),
              h.div([h.Class("text-xs text-muted-foreground")], [sessionTimerView(runner, h)]),
            ],
          ),
          h.div([h.Class("flex items-center justify-end")], [endAction(h)]),
        ],
      ),
    ],
  );

export const phoneNavBar = (runner: RunnerState, h: HtmlBuilder<Message>) =>
  runnerNavBar(runner, [taskListAction(runner, h)], h);

// ── Action bar ──────────────────────────────────────────────────────────────

const missingRequiredCount = (task: RunnerTask): number =>
  task.sections.filter((section) => !isSectionDone(section)).length;

const recordHint = (task: RunnerTask): string => {
  const missing = missingRequiredCount(task);
  const verb = task.isBeingEdited ? "to save" : "first";
  if (!task.isBeingEdited && task.endDate !== null)
    return "This task is already recorded. Pick it in the task list to change it.";
  return missing === 1
    ? `Answer the required question ${verb}.`
    : `Answer the ${missing} required questions ${verb}.`;
};

/** The one action that matters, always within thumb reach. */
export const runnerActionBar = (runner: RunnerState, task: RunnerTask, h: HtmlBuilder<Message>) => {
  const isEditing = task.isBeingEdited;
  const canRecord = canRecordTask(task);
  const canSave = isTaskDone(task);

  const actions = isEditing
    ? [
        actionGroup(
          {
            cancel: {
              label: "Cancel",
              onClick: Message.ClickedCancelEdit(),
              ariaLabel: "Cancel editing",
            },
            confirm: {
              label: "Save",
              onClick: Message.ClickedSaveEdit(),
              isDisabled: !canSave,
              ariaLabel: "Save changes",
            },
          },
          h,
        ),
        ...(canSave ? [] : [hint(recordHint(task), h)]),
      ]
    : [
        button(
          {
            size: "lg",
            className: "w-full",
            isDisabled: !canRecord,
            onClick: Message.ClickedRecord(),
            attributes: [h.AriaLabel("Record task")],
          },
          [icon(h, Check, "size-5"), "Record task"],
          h,
        ),
        ...(canRecord ? [] : [hint(recordHint(task), h)]),
      ];

  return h.div(
    [
      h.Class("shrink-0 border-t border-border/70 bg-background/90 pb-safe backdrop-blur-xl"),
      h.DataAttribute("slot", "action-bar"),
    ],
    [
      h.div(
        [h.Class("mx-auto flex w-full max-w-3xl flex-col gap-2 px-safe pt-3 pb-3")],
        [...(runner.lastError === null ? [] : [errorAlert(runner.lastError, h)]), ...actions],
      ),
    ],
  );
};

// ── Task list ───────────────────────────────────────────────────────────────

const taskStatus = (task: RunnerTask): "recording" | "editing" | "done" =>
  task.endDate === null ? "recording" : task.isBeingEdited ? "editing" : "done";

const firstAnswer = (task: RunnerTask): string => {
  const answered = task.sections
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .find((section) => section.value !== "");
  if (answered === undefined) return "No answers yet";
  if (answered.kind === "boolean") {
    return `${answered.name}: ${isBooleanTrue(answered.value) ? "Yes" : "No"}`;
  }
  return answered.value;
};

const taskValue = (task: RunnerTask): string | undefined => {
  const start = taskStartDate(task);
  if (start === null) return undefined;
  if (task.endDate === null) return formatTimeOnly(start);
  return formatDurationHms(task.endDate - start);
};

/** One row per task; shared by the phone sheet and the tablet sidebar. */
export const taskRow = (
  task: RunnerTask,
  options: Readonly<{ isCurrent: boolean; showValue?: boolean }>,
  h: HtmlBuilder<Message>,
) => {
  const status = taskStatus(task);
  const label =
    status === "recording" ? "in progress" : status === "editing" ? "editing" : "completed";
  return row(
    {
      lazy: true,
      title: `Task ${task.orderIndex}`,
      subtitle: firstAnswer(task),
      value: options.showValue === false ? undefined : taskValue(task),
      trailing: statusPill(
        {
          tone: status === "recording" ? "success" : status === "editing" ? "warning" : "neutral",
        },
        [status === "recording" ? "Recording" : status === "editing" ? "Editing" : "Done"],
        h,
      ),
      onClick: Message.ClickedSelectTask({ taskId: task.id }),
      attributes: [
        h.AriaLabel(`Task ${task.orderIndex} ${label}`),
        ...(options.isCurrent ? [h.AriaCurrent("true")] : []),
      ],
    },
    h,
  );
};

export const taskRows = (
  runner: RunnerState,
  h: HtmlBuilder<Message>,
  options: Readonly<{ showValue?: boolean }> = {},
): ReadonlyArray<Html> => {
  const sorted = runner.tasks.toSorted((a, b) => b.orderIndex - a.orderIndex);
  const currentId = currentTask(runner)?.id ?? runner.currentTaskId;
  return sorted.map((task) => taskRow(task, { ...options, isCurrent: task.id === currentId }, h));
};

const taskListSheet = (runner: RunnerState, h: HtmlBuilder<Message>) =>
  sheet(
    {
      id: "runner-tasks",
      title: "Tasks",
      description: `${runner.completedCount} recorded. Tap a task to change its answers.`,
      onDismiss: Message.ToggledTaskList(),
      dismissLabel: "Close task list",
      size: "md",
      footer: {
        confirm: {
          label: "Done",
          onClick: Message.ToggledTaskList(),
          ariaLabel: "Close task list",
        },
      },
    },
    [groupedList({}, [...taskRows(runner, h)], h)],
    h,
  );

// ── End session & errors ────────────────────────────────────────────────────

export const endConfirmModal = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const count = runner.completedCount;
  const message =
    count === 0
      ? "Nothing has been recorded yet, so nothing will be kept."
      : `${count} task${count === 1 ? "" : "s"} recorded. You can review and export them from History.`;
  return confirmSheet(
    {
      id: "end-session",
      title: "End session?",
      message,
      confirmLabel: "End session",
      confirmAriaLabel: "End session",
      cancelAriaLabel: "Keep recording",
      cancelLabel: "Keep recording",
      dismissLabel: "Cancel ending session",
      onConfirm: Message.ConfirmedEndSession(),
      onCancel: Message.CanceledEndSession(),
    },
    h,
  );
};

/** Inline, dismissible failure message shown just above the action bar. */
export const errorAlert = (message: string, h: HtmlBuilder<Message>) =>
  notice(
    {
      tone: "error",
      text: message,
      onDismiss: Message.DismissedRunnerError(),
      dismissLabel: "Dismiss error",
    },
    h,
  );

// ── Placeholder states ──────────────────────────────────────────────────────

export const runnerLoadingView = (h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("flex h-full items-center justify-center p-8")],
    [h.p([h.Class("text-sm text-muted-foreground"), h.Role("status")], ["Loading session…"])],
  );

export const runnerEmptyTaskView = (h: HtmlBuilder<Message>) =>
  emptyState(
    {
      icon: Timer,
      title: "Nothing to record",
      description: "This session has no task to fill in. End it and start a new one.",
    },
    h,
  );

// ── Public entry ────────────────────────────────────────────────────────────

type RunnerModel = {
  readonly runner: RunnerState | null;
};

export const runnerView = (model: RunnerModel, h: HtmlBuilder<Message>) => {
  const runner = model.runner;
  if (runner === null) return runnerLoadingView(h);

  const task = currentTask(runner);
  if (task === null) return runnerEmptyTaskView(h);

  return h.div(
    [h.Class("flex h-full min-h-0 w-full flex-col bg-background text-foreground")],
    [
      phoneNavBar(runner, h),
      runnerCanvas({ task, scope: "mobile" }, h),
      runnerActionBar(runner, task, h),
      ...(runner.showTaskList ? [taskListSheet(runner, h)] : []),
      ...(runner.showEndConfirm ? [endConfirmModal(runner, h)] : []),
    ],
  );
};
