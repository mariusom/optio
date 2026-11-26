import { Array, Option, Order } from "effect";
import type { H, Ui } from "@/lib/view";

import {
  Check,
  Timer,
  emptyState,
  groupedList,
  icon,
  loadingState,
  navBarAction,
  notice,
  row,
  statusPill,
  confirmSheet,
  sheet,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { Message } from "../../../messages";
import { formatDurationHms, formatTimeOnly } from "../../format";
import { isBooleanTrue, isScalarAnswerValid } from "../../fields";
import { formSectionsView } from "./questionControls";
import { primaryShortcut, primaryShortcutHint } from "./runnerShortcuts";
import {
  canRecordTask,
  currentTask,
  isTaskDone,
  taskStartDate,
  type RunnerState,
  type RunnerTask,
} from "./runner";
import {
  announcementView,
  requiredProgress,
  sessionTimerView,
  taskCountLabel,
  taskCountName,
} from "./runnerStatus";

export { formSectionsView } from "./questionControls";

/** Scrolling form area; identical on phone, tablet and desktop. */
export const runnerCanvas = (
  options: Readonly<{ runner: RunnerState; task: RunnerTask; scope: string }>,
  h: H<Message>,
) =>
  h.div
    .class("min-h-0 flex-1 overflow-y-auto overscroll-y-contain")
    .attr("data-runner-layout", "")
    .children(formSectionsView(options.task, h, { scope: options.scope }));

// ── Nav bar pieces ──────────────────────────────────────────────────────────

/** Ends recording, so it is neutral rather than a "success" action; it confirms first. */
const endAction = (h: H<Message>) =>
  button(
    {
      variant: "outline",
      onClick: Message.ClickedEndSession(),
      attrs: { "aria-label": "End session" },
    },
    "End",
    h,
  );

const taskListAction = (runner: RunnerState, h: H<Message>) =>
  navBarAction(
    {
      label: taskCountLabel(runner, h),
      onClick: Message.ToggledTaskList(),
      ariaLabel: taskCountName(runner, "show task list"),
    },
    h,
  );

export const runnerNavBar = (
  runner: RunnerState,
  controls: Readonly<{ leading?: ReadonlyArray<Ui>; trailing?: ReadonlyArray<Ui> }>,
  h: H<Message>,
) =>
  h.header
    .class("sticky top-0 z-20 shrink-0 border-b border-border/70 bg-background pt-safe select-none")
    .attr("data-slot", "nav-bar")
    .children(
      h.div
        .class(
          "grid min-h-16 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 px-safe py-2 sm:gap-3",
        )
        .children(
          h.div.class("flex items-center justify-start").children(controls.leading ?? []),
          h.div.class("min-w-0 text-center").children(
            h.h1
              .class("truncate text-sm font-semibold tracking-tight sm:text-base")
              .attr("dir", "auto")
              .children(runner.sessionName === "" ? runner.templateName : runner.sessionName),
            sessionTimerView(runner, h),
          ),
          h.div
            .class("flex items-center justify-end gap-2")
            .children(controls.trailing ?? [], endAction(h)),
        ),
    );

const phoneNavBar = (runner: RunnerState, h: H<Message>) =>
  runnerNavBar(runner, { leading: [taskListAction(runner, h)] }, h);

// ── Action bar ──────────────────────────────────────────────────────────────

const recordHint = (task: RunnerTask): string | null => {
  if (Array.some(task.sections, (section) => !isScalarAnswerValid(section.kind, section.value)))
    return "Correct invalid answers.";
  if (!task.isBeingEdited && task.endDate !== null)
    return "This task is already recorded. Pick it in the task list to change it.";
  return null;
};

/** The one action that matters, always within thumb reach. */
export const runnerActionBar = (
  { runner, task, scope }: Readonly<{ runner: RunnerState; task: RunnerTask; scope: string }>,
  h: H<Message>,
) => {
  const isEditing = task.isBeingEdited;
  const canSubmit = isEditing ? isTaskDone(task) : canRecordTask(task);
  const actionHint = canSubmit ? null : recordHint(task);
  const hasError = runner.lastError !== null || actionHint !== null;
  const showAnnouncement = !hasError && runner.announcement !== null;
  const statusId = `${scope}-runner-action-status`;
  const actionAttributes = {
    "aria-keyshortcuts": primaryShortcut,
    "aria-describedby": !(canSubmit || showAnnouncement)
      ? hasError
        ? statusId
        : `${scope}-required-answer-label`
      : undefined,
  };
  const status =
    runner.lastError !== null
      ? [errorAlert(runner.lastError, h)]
      : actionHint !== null
        ? [
            h.p
              .attr("role", "alert")
              .class("text-destructive text-sm font-medium")
              .children(actionHint),
          ]
        : showAnnouncement
          ? []
          : [
              requiredProgress(task, scope, h) ??
                h.span.class("text-muted-foreground text-sm").children("No required questions"),
            ];

  const actions = isEditing
    ? h.div.class("grid grid-cols-2 gap-2").children(
        button(
          {
            size: "lg",
            variant: "secondary",
            className: "rounded-full",
            onClick: Message.ClickedCancelEdit(),
            attrs: { "aria-label": "Cancel editing" },
          },
          "Cancel",
          h,
        ),
        button(
          {
            size: "lg",
            className: "@container relative rounded-full shadow-lg shadow-primary/20",
            isDisabled: !canSubmit,
            onClick: Message.ClickedSaveEdit(),
            attrs: { "aria-label": "Save changes", ...actionAttributes },
          },
          ["Save", primaryShortcutHint(h)],
          h,
        ),
      )
    : button(
        {
          size: "lg",
          className: "@container relative w-full rounded-full shadow-lg shadow-primary/20",
          isDisabled: !canSubmit,
          onClick: Message.ClickedRecord(),
          attrs: { "aria-label": "Record task", ...actionAttributes },
        },
        [icon(h, Check, "size-5"), "Record task", primaryShortcutHint(h)],
        h,
      );

  return h.div
    .class(
      "shrink-0 bg-linear-to-t from-background from-70% to-background/0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
    )
    .attr("data-slot", "action-bar")
    .children(
      h.div
        .class("mx-auto flex w-full max-w-3xl flex-col gap-2 px-safe pt-2")
        .children(
          h.div
            .class("relative flex min-h-5 flex-col justify-center")
            .children(
              announcementView(runner.announcement, showAnnouncement, h),
              h.div.id(statusId).children(status),
            ),
          actions,
        ),
    );
};

// ── Task list ───────────────────────────────────────────────────────────────

const taskStatus = (task: RunnerTask): "recording" | "editing" | "done" =>
  task.endDate === null ? "recording" : task.isBeingEdited ? "editing" : "done";

const bySortOrder = Order.mapInput(
  Order.Number,
  (section: RunnerTask["sections"][number]) => section.sortOrder,
);

const firstAnswer = (task: RunnerTask): string => {
  const found = Array.findFirst(
    Array.sort(task.sections, bySortOrder),
    (section) => section.value !== "",
  );
  if (Option.isNone(found)) return "No answers yet";
  const answered = found.value;
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

/**
 * Status pill text with at least 4.5:1 contrast: success text is darkened
 * (lightened in dark mode) on its tint. The neutral tone already passes.
 */
const pillContrast = {
  recording: "text-[color-mix(in_oklab,var(--color-success)_65%,var(--color-foreground))]",
  editing: undefined,
  done: undefined,
} as const;

/** One row per task; shared by the phone sheet and the tablet sidebar. */
const taskRow = (
  task: RunnerTask,
  options: Readonly<{ isCurrent: boolean; showValue?: boolean }>,
  h: H<Message>,
) => {
  const status = taskStatus(task);
  return row(
    {
      key: task.id,
      lazy: true,
      title: `Task ${task.orderIndex}`,
      subtitle: firstAnswer(task),
      value: options.showValue === false ? undefined : taskValue(task),
      trailing: statusPill(
        {
          tone: status === "recording" ? "success" : status === "editing" ? "warning" : "neutral",
          className: pillContrast[status],
        },
        [status === "recording" ? "Recording" : status === "editing" ? "Editing" : "Done"],
        h,
      ),
      onClick: Message.ClickedSelectTask({ taskId: task.id }),
      // Muted text is below 4.5:1 on the selected row's accent background.
      className: options.isCurrent ? "[&_.text-muted-foreground]:text-foreground/75" : undefined,
      // Named by its visible text ("Task 2 … Recording"), so voice control matches it.
      attrs: options.isCurrent ? { "aria-current": "true" } : {},
    },
    h,
  );
};

export const taskRows = (
  runner: RunnerState,
  h: H<Message>,
  options: Readonly<{ showValue?: boolean }> = {},
): ReadonlyArray<Ui> => {
  const sorted = Array.sort(runner.tasks, newestFirst);
  const currentId = currentTask(runner)?.id ?? runner.currentTaskId;
  return Array.map(sorted, (task) =>
    taskRow(task, { ...options, isCurrent: task.id === currentId }, h),
  );
};

const newestFirst = Order.mapInput(Order.flip(Order.Number), (task: RunnerTask) => task.orderIndex);

const taskListSheet = (runner: RunnerState, h: H<Message>) =>
  sheet(
    {
      id: "runner-tasks",
      title: "Tasks",
      description: `${runner.completedCount} recorded. Select a task to change its answers.`,
      onDismiss: Message.ToggledTaskList(),
      placement: "side",
      footer: {
        confirm: {
          label: "Done",
          onClick: Message.ToggledTaskList(),
          ariaLabel: "Done, close task list",
        },
      },
    },
    [groupedList({}, [...taskRows(runner, h)], h)],
    h,
  );

/**
 * Sheets over the live session. Rendered once, outside the responsive phone
 * and tablet copies, so a hidden copy never holds the open dialog.
 */
export const runnerSheets = (runner: RunnerState | null, h: H<Message>) =>
  runner === null || currentTask(runner) === null
    ? []
    : [
        ...(runner.showTaskList ? [taskListSheet(runner, h)] : []),
        ...(runner.showEndConfirm ? [endConfirmModal(runner, h)] : []),
      ];

// ── End session & errors ────────────────────────────────────────────────────

export const endConfirmModal = (runner: RunnerState, h: H<Message>) => {
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
      onConfirm: Message.ConfirmedEndSession(),
      onCancel: Message.CanceledEndSession(),
    },
    h,
  );
};

/** Inline, dismissible failure message shown just above the action bar. */
export const errorAlert = (message: string, h: H<Message>) =>
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

export const runnerLoadingView = (h: H<Message>) => loadingState("Loading session…", h);

export const runnerEmptyTaskView = (h: H<Message>) =>
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

export const runnerView = (model: RunnerModel, h: H<Message>) => {
  const runner = model.runner;
  if (runner === null) return runnerLoadingView(h);

  const task = currentTask(runner);
  if (task === null) return runnerEmptyTaskView(h);

  return h.div
    .class("flex h-full min-h-0 w-full flex-col bg-background text-foreground")
    .attr("data-runner-layout", "")
    .children(
      phoneNavBar(runner, h),
      runnerCanvas({ runner, task, scope: "mobile" }, h),
      runnerActionBar({ runner, task, scope: "mobile" }, h),
    );
};
