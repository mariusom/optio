import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Check,
  List,
  Timer,
  confirmSheet,
  emptyState,
  groupedList,
  hint,
  icon,
  navBar,
  navBarAction,
  notice,
  row,
  sheet,
  statusPill,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { switch_ } from "@/components/ui/switch";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { formatClock, formatDurationHms, formatTimeOnly } from "../../format";
import { isBooleanTrue, toggleCheckboxOption } from "../../fields";
import {
  canRecordTask,
  currentTask,
  isSectionDone,
  isTaskDone,
  taskStartDate,
  type RunnerSection,
  type RunnerState,
  type RunnerTask,
} from "./runner";

// ── Status line ─────────────────────────────────────────────────────────────

/** Compact live status under the title: "Task 4 · 00:42 · 3 recorded". */
export const sessionTimerView = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const task = currentTask(runner);
  const isEditing = task !== null && task.isBeingEdited;
  const taskStart = task === null ? null : taskStartDate(task);
  const isRecording = !isEditing && taskStart !== null;
  const elapsed =
    taskStart !== null
      ? Math.max(0, runner.now - taskStart)
      : Math.max(0, runner.now - runner.startedAt);
  const recorded = `${runner.completedCount} recorded`;
  const parts =
    task === null
      ? [formatClock(elapsed), recorded]
      : isEditing
        ? [`Editing task ${task.orderIndex}`, recorded]
        : [`Task ${task.orderIndex}`, formatClock(elapsed), recorded];

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

// ── Question controls ───────────────────────────────────────────────────────

const choiceBody = (
  label: string,
  caption: string | null,
  indicator: Html,
  h: HtmlBuilder<Message>,
) =>
  h.span(
    [h.Class("flex min-h-14 w-full items-center gap-3 px-4 py-3 text-base leading-snug")],
    [
      h.span(
        [h.Class("flex min-w-0 flex-1 flex-col text-left")],
        [
          h.span([h.Class("truncate")], [label]),
          ...(caption === null
            ? []
            : [h.span([h.Class("text-xs text-muted-foreground")], [caption])]),
        ],
      ),
      indicator,
    ],
  );

const checkMark = (isSelected: boolean, h: HtmlBuilder<Message>) =>
  isSelected
    ? icon(h, Check, "size-5 shrink-0 text-primary")
    : h.span([h.Class("size-5 shrink-0"), h.AriaHidden(true)], []);

const checkBox = (isSelected: boolean, h: HtmlBuilder<Message>) =>
  h.span(
    [
      h.Class(
        cn(
          "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
          isSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input text-transparent",
        ),
      ),
      h.AriaHidden(true),
    ],
    [icon(h, Check, "size-4")],
  );

/** Single choice: native radios keep arrow-key and single-tab-stop behaviour. */
const singleChoiceGroup = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("divide-y divide-border/80"), h.Role("radiogroup"), h.AriaLabel(section.name)],
    section.options.map((option) => {
      const isSelected = section.value === option;
      return h.label(
        [
          h.Class(
            cn(
              "flex w-full cursor-pointer transition-colors active:bg-muted",
              "has-[:focus-visible]:bg-muted/70",
              isSelected ? "bg-primary/8 text-primary" : "hover:bg-muted/60",
            ),
          ),
        ],
        [
          h.input([
            h.Class("sr-only"),
            h.Type("radio"),
            // Both responsive copies are mounted; keep their native groups apart.
            h.Name(`${scope}-${section.id}`),
            h.Value(option),
            h.Checked(isSelected),
            h.AriaLabel(option),
            h.OnChange(() => Message.ChangedFieldValue({ taskFieldId: section.id, value: option })),
          ]),
          choiceBody(option, null, checkMark(isSelected, h), h),
        ],
      );
    }),
  );

/** Multiple choice: a check box per option; exclusive options say so plainly. */
const multipleChoiceGroup = (section: RunnerSection, h: HtmlBuilder<Message>) => {
  const selected = new Set(section.value.split(",").filter((value) => value !== ""));
  return h.div(
    [h.Class("divide-y divide-border/80"), h.Role("group"), h.AriaLabel(section.name)],
    section.options.map((option) => {
      const isSelected = selected.has(option);
      const isExclusive = section.exclusiveOptions.includes(option);
      const nextValue = toggleCheckboxOption(
        section.value,
        option,
        section.options,
        section.exclusiveOptions,
      );
      return h.button(
        [
          h.Type("button"),
          h.Class(
            cn(
              "flex w-full transition-colors active:bg-muted focus-visible:bg-muted/70",
              isSelected ? "bg-primary/8 text-primary" : "hover:bg-muted/60",
            ),
          ),
          h.Role("checkbox"),
          h.AriaChecked(isSelected),
          h.AriaLabel(option),
          h.OnClick(Message.ChangedFieldValue({ taskFieldId: section.id, value: nextValue })),
        ],
        [
          choiceBody(
            option,
            isExclusive && !isSelected ? "Clears the others" : null,
            checkBox(isSelected, h),
            h,
          ),
        ],
      );
    }),
  );
};

const textAnswer = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("px-4 py-3")],
    [
      h.input([
        h.Class(cn(inputClass)),
        h.Value(section.value),
        h.Placeholder("Type your answer"),
        h.AriaLabel(section.name),
        h.Attribute("aria-required", section.isRequired ? "true" : "false"),
        h.Autocomplete("off"),
        h.Autocapitalize("sentences"),
        h.EnterKeyHint("next"),
        h.OnInput((value) => Message.ChangedFieldValue({ taskFieldId: section.id, value })),
      ]),
    ],
  );

const notesAnswer = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("px-4 py-3")],
    [
      h.textarea([
        h.Class(cn(textareaClass)),
        h.Value(section.value),
        h.Placeholder("Add anything worth remembering"),
        h.AriaLabel(section.name),
        h.Attribute("aria-required", section.isRequired ? "true" : "false"),
        h.Autocomplete("off"),
        h.Autocapitalize("sentences"),
        h.Attribute("rows", "3"),
        h.OnInput((value) => Message.ChangedFieldValue({ taskFieldId: section.id, value })),
      ]),
    ],
  );

const yesNoAnswer = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) => {
  const isOn = isBooleanTrue(section.value);
  return h.div(
    [h.Class("flex min-h-14 items-center px-4 py-1"), h.Role("group"), h.AriaLabel(section.name)],
    [
      switch_(
        {
          id: `${scope}-runner-toggle-${section.id}`,
          isChecked: isOn,
          label: isOn ? "Yes" : "No",
          wrapperClass: "w-full",
          onToggle: (checked) =>
            Message.ChangedFieldValue({
              taskFieldId: section.id,
              value: checked ? "true" : "false",
            }),
        },
        h,
      ),
    ],
  );
};

const answerControl = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) => {
  switch (section.kind) {
    case "radio":
      return singleChoiceGroup(section, scope, h);
    case "checkbox":
      return multipleChoiceGroup(section, h);
    case "textArea":
      return notesAnswer(section, h);
    case "boolean":
      return yesNoAnswer(section, scope, h);
    default:
      return textAnswer(section, h);
  }
};

const questionFooter = (section: RunnerSection): string | undefined =>
  section.kind === "checkbox" ? "Pick as many as apply." : undefined;

const questionView = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  groupedList(
    {
      header: h.span(
        [h.Class("flex items-center gap-2 normal-case")],
        [
          h.span([h.Class("min-w-0 text-sm font-semibold tracking-normal")], [section.name]),
          ...(section.isRequired ? [statusPill({ tone: "primary" }, ["Required"], h)] : []),
        ],
      ),
      footer: questionFooter(section),
      attributes: [h.Id(`${scope}-${section.id}`)],
    },
    [answerControl(section, scope, h)],
    h,
  );

// ── Form canvas ─────────────────────────────────────────────────────────────

export const formSectionsView = (
  _runner: RunnerState,
  task: RunnerTask,
  h: HtmlBuilder<Message>,
  scope = "mobile",
) => {
  const sections = [...task.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  return h.div(
    [h.Class("mx-auto flex w-full max-w-3xl flex-col gap-6 px-safe pt-4 pb-8")],
    [
      h.div([h.Class("h-0 w-full scroll-mt-16"), h.Id(`${scope}-formTop`)], []),
      ...sections.map((section) => questionView(section, scope, h)),
    ],
  );
};

/** Scrolling form area; identical on phone, tablet and desktop. */
export const runnerCanvas = (
  runner: RunnerState,
  task: RunnerTask,
  scope: string,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class("min-h-0 flex-1 overflow-y-auto overscroll-y-contain")],
    [formSectionsView(runner, task, h, scope)],
  );

// ── Nav bar pieces ──────────────────────────────────────────────────────────

const endAction = (h: HtmlBuilder<Message>) =>
  navBarAction(
    {
      label: h.span([h.Class("text-destructive")], ["End"]),
      onClick: Message.ClickedEndSession(),
      ariaLabel: "End session",
    },
    h,
  );

const taskListAction = (runner: RunnerState, h: HtmlBuilder<Message>) =>
  navBarAction(
    {
      label: h.span(
        [h.Class("flex items-center gap-1.5")],
        [icon(h, List, "size-5"), h.span([h.Class("tabular")], [`${runner.tasks.length}`])],
      ),
      onClick: Message.ToggledTaskList(),
      ariaLabel: "Show task list",
    },
    h,
  );

export const runnerNavBar = (
  runner: RunnerState,
  trailing: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
) =>
  navBar(
    {
      title: runner.sessionName === "" ? runner.templateName : runner.sessionName,
      subtitle: sessionTimerView(runner, h),
      leading: endAction(h),
      trailing,
    },
    h,
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
        h.div(
          [h.Class("flex gap-3 [&>*]:flex-1")],
          [
            button(
              {
                variant: "secondary",
                size: "lg",
                onClick: Message.ClickedCancelEdit(),
                attributes: [h.AriaLabel("Cancel editing")],
              },
              "Cancel",
              h,
            ),
            button(
              {
                size: "lg",
                isDisabled: !canSave,
                onClick: Message.ClickedSaveEdit(),
                attributes: [h.AriaLabel("Save changes")],
              },
              [icon(h, Check, "size-5"), "Save"],
              h,
            ),
          ],
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
  const answered = [...task.sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
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
  isCurrent: boolean,
  h: HtmlBuilder<Message>,
  options: Readonly<{ showValue?: boolean }> = {},
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
        ...(isCurrent ? [h.AriaCurrent("true")] : []),
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
  const sorted = [...runner.tasks].sort((a, b) => b.orderIndex - a.orderIndex);
  const currentId = currentTask(runner)?.id ?? runner.currentTaskId;
  return sorted.map((task) => taskRow(task, task.id === currentId, h, options));
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
      footer: [
        button(
          {
            variant: "secondary",
            size: "lg",
            onClick: Message.ToggledTaskList(),
            attributes: [h.AriaLabel("Close task list")],
          },
          "Done",
          h,
        ),
      ],
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
      runnerCanvas(runner, task, "mobile", h),
      runnerActionBar(runner, task, h),
      ...(runner.showTaskList ? [taskListSheet(runner, h)] : []),
      ...(runner.showEndConfirm ? [endConfirmModal(runner, h)] : []),
    ],
  );
};
