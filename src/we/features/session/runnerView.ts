import { svgIcon } from "../../ui";
import type { HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import { formatClock, formatTimeOnly, formatDurationHms } from "../../format";
import { isBooleanTrue, toggleCheckboxOption } from "../../fields";
import {
  canRecordTask,
  currentTask,
  isSectionDone,
  taskStartDate,
  type RunnerSection,
  type RunnerState,
  type RunnerTask,
} from "./runner";

// ── Icons ───────────────────────────────────────────────────────────────────

const clockTinyIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.polyline([h.Attribute("points", "12 7 12 12 15 15")], []),
  ]);

const listBulletIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.line(
      [
        h.Attribute("x1", "8"),
        h.Attribute("y1", "6"),
        h.Attribute("x2", "20"),
        h.Attribute("y2", "6"),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "8"),
        h.Attribute("y1", "12"),
        h.Attribute("x2", "20"),
        h.Attribute("y2", "12"),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "8"),
        h.Attribute("y1", "18"),
        h.Attribute("x2", "20"),
        h.Attribute("y2", "18"),
      ],
      [],
    ),
    h.circle(
      [
        h.Attribute("cx", "4"),
        h.Attribute("cy", "6"),
        h.Attribute("r", "1"),
        h.Attribute("fill", "currentColor"),
      ],
      [],
    ),
    h.circle(
      [
        h.Attribute("cx", "4"),
        h.Attribute("cy", "12"),
        h.Attribute("r", "1"),
        h.Attribute("fill", "currentColor"),
      ],
      [],
    ),
    h.circle(
      [
        h.Attribute("cx", "4"),
        h.Attribute("cy", "18"),
        h.Attribute("r", "1"),
        h.Attribute("fill", "currentColor"),
      ],
      [],
    ),
  ]);

const checkIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [h.polyline([h.Attribute("points", "20 6 9 17 4 12")], [])], "2.5");

// ── SessionTimerView ────────────────────────────────────────────────────────

export const sessionTimerView = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const task = currentTask(runner);
  const isEditing = task !== null && task.isBeingEdited;
  const taskStart = task !== null ? taskStartDate(task) : null;
  const isRecording = !isEditing && taskStart !== null;
  const now = runner.now;

  const taskElapsed = taskStart !== null ? Math.max(0, now - taskStart) : 0;
  const sessionElapsed = Math.max(0, now - runner.startedAt);

  const taskClock = formatClock(taskElapsed);
  const sessionClock = formatClock(sessionElapsed);

  const dotColor = isEditing
    ? "text-warning"
    : isRecording
      ? "text-success"
      : "text-base-content/25";
  const dotPulse = isRecording ? " animate-pulse" : "";

  return h.div(
    [h.Class("flex items-center gap-2.5")],
    [
      // pulsing dot
      h.div(
        [
          h.Class(`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}${dotPulse}`),
          h.Attribute("style", `background:currentColor`),
          h.Attribute("aria-hidden", "true"),
        ],
        [],
      ),
      h.div(
        [h.Class("flex flex-col gap-0.5")],
        isEditing
          ? [
              h.span([h.Class("text-sm font-bold text-warning tracking-wide")], ["EDITING"]),
              h.span(
                [h.Class("text-[11px] text-base-content/60 font-mono")],
                [`Session ${sessionClock} · ${runner.completedCount} recorded`],
              ),
            ]
          : [
              h.span(
                [
                  h.Class(
                    "font-mono text-[1.35rem] font-semibold leading-none tracking-tight tabular-nums text-base-content",
                  ),
                  h.Attribute("style", "font-variant-numeric: tabular-nums"),
                ],
                [taskClock],
              ),
              h.span(
                [h.Class("text-[11px] text-base-content/60 font-mono")],
                [`Session ${sessionClock} · ${runner.completedCount} recorded`],
              ),
            ],
      ),
    ],
  );
};

// ── FormSelectionButton ─────────────────────────────────────────────────────

const selectionButton = (
  value: string,
  active: boolean,
  h: HtmlBuilder<Message>,
  type: "radio" | "checkbox" = "radio",
  isExclusive = false,
) =>
  h.div(
    [
      h.Class(
        `flex min-h-[48px] w-full items-center justify-between rounded-field px-4 py-3 text-sm font-medium leading-tight transition-all duration-150 active:scale-[0.98] select-none border ${
          active
            ? "bg-primary text-primary-content border-primary shadow-sm"
            : "bg-base-100 border-base-300 shadow-xs text-base-content hover:border-base-300/80 hover:bg-base-200/50"
        }`,
      ),
    ],
    [
      h.span([h.Class("truncate flex-1 text-left")], [value]),
      ...(isExclusive && !active
        ? [
            h.span(
              [h.Class("badge badge-xs badge-neutral shrink-0 ml-1.5 opacity-60 text-[10px]")],
              ["Exclusive"],
            ),
          ]
        : []),
      h.div(
        [
          h.Class(
            `flex h-5 w-5 shrink-0 items-center justify-center rounded-${
              type === "radio" ? "full" : "selector"
            } border transition-colors ml-2 ${
              active
                ? "bg-white/20 border-white text-white"
                : "bg-transparent border-base-300 text-transparent"
            }`,
          ),
          h.Attribute("aria-hidden", "true"),
        ],
        [
          type === "radio"
            ? h.div([h.Class(`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-transparent"}`)], [])
            : checkIcon("h-3 w-3", h),
        ],
      ),
    ],
  );

// ── FormSectionHeader ───────────────────────────────────────────────────────

const formSectionHeader = (
  section: RunnerSection,
  done: boolean,
  showCheck: boolean,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class("flex items-center gap-1 px-4 pt-4 pb-1.5")],
    [
      h.span(
        [h.Class("text-xs font-semibold uppercase tracking-wider text-base-content/60")],
        [section.name.toUpperCase()],
      ),
      ...(section.isRequired
        ? [h.span([h.Class("text-xs font-bold text-error ml-0.5")], ["*"])]
        : []),
      ...(showCheck
        ? [
            h.span(
              [
                h.Class("ml-1.5 text-success font-bold text-xs transition-transform duration-300"),
                h.Attribute("style", "animation: scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1)"),
                h.AriaLabel("Completed"),
              ],
              ["✓"],
            ),
          ]
        : []),
      h.div([h.Class("flex-1")], []),
    ],
  );

// ── Form groups ─────────────────────────────────────────────────────────────

const formRadioGroup = (
  section: RunnerSection,
  task: RunnerTask,
  sections: ReadonlyArray<RunnerSection>,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [
      h.Class("grid gap-2.5"),
      h.Attribute("style", "grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))"),
      h.Attribute("role", "radiogroup"),
      h.AriaLabel(section.name),
    ],
    section.options.map((option) => {
      const active = section.value === option;
      return h.button(
        [
          h.Class("w-full text-left focus-visible:outline-none rounded-field"),
          h.Attribute("role", "radio"),
          h.AriaChecked(active),
          h.AriaLabel(option),
          h.OnClick(Message.ChangedFieldValue({ taskFieldId: section.id, value: option })),
        ],
        [selectionButton(option, active, h, "radio")],
      );
    }),
  );

const formCheckboxGroup = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class("grid gap-2.5"),
      h.Attribute("style", "grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))"),
      h.Attribute("role", "group"),
      h.AriaLabel(section.name),
    ],
    section.options.map((option) => {
      const selectedSet = new Set(section.value.split(",").filter((v) => v !== ""));
      const isSelected = selectedSet.has(option);
      const isExclusive = section.exclusiveOptions.includes(option);
      const hint = isSelected
        ? "Selected. Tap to deselect"
        : isExclusive
          ? "Tap to select. This will clear all other selections"
          : selectedSet.size > 0 &&
              [...selectedSet].some((v) => section.exclusiveOptions.includes(v))
            ? "Tap to select. This will clear the exclusive option"
            : "Tap to select";
      const nextValue = toggleCheckboxOption(
        section.value,
        option,
        section.options,
        section.exclusiveOptions,
      );
      return h.button(
        [
          h.Class("w-full text-left focus-visible:outline-none rounded-field"),
          h.Attribute("role", "checkbox"),
          h.AriaChecked(isSelected),
          h.AriaLabel(option),
          h.Title(hint),
          h.OnClick(Message.ChangedFieldValue({ taskFieldId: section.id, value: nextValue })),
        ],
        [selectionButton(option, isSelected, h, "checkbox", isExclusive)],
      );
    }),
  );

const formFieldChromeClass =
  "rounded-field border bg-base-100 px-3.5 py-3 shadow-xs transition-all duration-150 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 border-base-300 hover:border-base-300/80";

const formTextField = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class(formFieldChromeClass)],
    [
      h.input([
        h.Class(
          "input input-ghost w-full h-auto min-h-0 p-0 border-0 bg-transparent text-base focus:outline-none focus-visible:outline-none placeholder:text-base-content/40",
        ),
        h.Value(section.value),
        h.Placeholder(section.name),
        h.AriaLabel(section.name),
        h.Attribute("aria-required", section.isRequired ? "true" : "false"),
        h.OnInput((v) => Message.ChangedFieldValue({ taskFieldId: section.id, value: v })),
        h.Attribute("autocomplete", "off"),
        h.Attribute("autocorrect", "off"),
      ]),
    ],
  );

const formTextArea = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class(formFieldChromeClass)],
    [
      h.textarea([
        h.Class(
          "textarea textarea-ghost w-full min-h-[90px] p-0 border-0 bg-transparent text-base leading-relaxed focus:outline-none focus-visible:outline-none placeholder:text-base-content/40 resize-none",
        ),
        h.Value(section.value),
        h.Placeholder(`Add ${section.name.toLowerCase()}…`),
        h.AriaLabel(section.name),
        h.Attribute("aria-required", section.isRequired ? "true" : "false"),
        h.OnInput((v) => Message.ChangedFieldValue({ taskFieldId: section.id, value: v })),
        h.Attribute("rows", "3"),
        h.Attribute("autocomplete", "off"),
      ]),
    ],
  );

const formToggle = (section: RunnerSection, h: HtmlBuilder<Message>) => {
  const isOn = isBooleanTrue(section.value);
  const next = isOn ? "false" : "true";
  return h.div(
    [
      h.Class(
        `flex items-center justify-between p-3.5 rounded-field border transition-all duration-150 select-none ${
          isOn
            ? "bg-primary/10 border-primary/40 shadow-xs"
            : "bg-base-100 border-base-300 shadow-xs hover:border-base-300/80"
        }`,
      ),
    ],
    [
      h.label(
        [h.Class("flex flex-col pr-3 cursor-pointer flex-1")],
        [
          h.span([h.Class("text-sm font-medium text-base-content")], [section.name]),
          h.span(
            [
              h.Class(
                `text-xs mt-0.5 ${isOn ? "text-primary font-medium" : "text-base-content/60"}`,
              ),
            ],
            [isOn ? "Active / Enabled" : "Off / Disabled"],
          ),
        ],
      ),
      h.input([
        h.Class("toggle toggle-primary checked:border-primary shrink-0"),
        h.Type("checkbox"),
        h.Attribute("role", "switch"),
        h.Checked(isOn),
        h.AriaChecked(isOn),
        h.AriaLabel(section.name),
        h.OnChange(() => Message.ChangedFieldValue({ taskFieldId: section.id, value: next })),
      ]),
    ],
  );
};

// ── FormSectionContent ──────────────────────────────────────────────────────

const formSectionContent = (
  section: RunnerSection,
  task: RunnerTask,
  sections: ReadonlyArray<RunnerSection>,
  h: HtmlBuilder<Message>,
) => {
  const kind = section.kind;
  if (kind === "radio") return formRadioGroup(section, task, sections, h);
  if (kind === "checkbox") return formCheckboxGroup(section, h);
  if (kind === "textArea") return formTextArea(section, h);
  if (kind === "textInput") return formTextField(section, h);
  if (kind === "boolean") return formToggle(section, h);
  return formTextField(section, h);
};

// ── FormSectionView ─────────────────────────────────────────────────────────

const formSectionView = (
  section: RunnerSection,
  task: RunnerTask,
  sections: ReadonlyArray<RunnerSection>,
  h: HtmlBuilder<Message>,
) => {
  const done = isSectionDone(section);
  const isBool = section.kind === "boolean";
  const showCheck = isBool ? isBooleanTrue(section.value) : done && section.value !== "";
  return h.div(
    [h.Class("flex flex-col bg-base-200"), h.Attribute("id", section.id)],
    [
      formSectionHeader(section, done, showCheck, h),
      h.div([h.Class("px-4 pb-4")], [formSectionContent(section, task, sections, h)]),
    ],
  );
};

// ── FormSectionsView (canvas) ───────────────────────────────────────────────

export const formSectionsView = (
  runner: RunnerState,
  task: RunnerTask,
  h: HtmlBuilder<Message>,
) => {
  const sections = [...task.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  return h.div(
    [h.Class("flex flex-col")],

    [
      // invisible anchor formTop
      h.div([h.Class("h-0 w-full"), h.Attribute("id", "formTop")], []),
      ...sections.flatMap((section, idx) => {
        const view = formSectionView(section, task, sections, h);
        const divider =
          idx < sections.length - 1 ? h.div([h.Class("mx-4 h-px bg-base-300")], []) : null;
        return divider ? [view, divider] : [view];
      }),
      // tail spacer 100pt
      h.div([h.Class("h-[100px] w-full shrink-0")], []),
    ],
  );
};

// ── BottomFadeGradient ──────────────────────────────────────────────────────

const bottomFadeGradient = (h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        "pointer-events-none fixed inset-x-0 bottom-0 h-[180px] bg-gradient-to-t from-base-200 via-base-200/80 to-transparent",
      ),
      h.Attribute("aria-hidden", "true"),
    ],
    [],
  );

// ── SessionBottomBar ────────────────────────────────────────────────────────

const sessionBottomBar = (
  runner: RunnerState,
  task: RunnerTask | null,
  h: HtmlBuilder<Message>,
) => {
  const isEditing = task !== null && task.isBeingEdited;
  const canRecord = canRecordTask(task);
  // For editing, Save enabled iff editing task isDone
  const canSave = isEditing ? canRecordTask(task) : true;

  if (isEditing) {
    return h.div(
      [
        h.Class(
          "fixed inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 pointer-events-none",
        ),
      ],
      [
        // Cancel + Save cluster on right; End hidden? Spec shows End still left, but when editing spec bottom bar shows Cancel/Save on right, End on left.
        h.div(
          [h.Class("flex w-full items-end justify-between gap-2 pointer-events-auto")],
          [
            h.button(
              [
                h.Class(
                  "btn btn-sm rounded-full bg-error/10 backdrop-blur-md border border-error/20 text-error hover:bg-error hover:text-white gap-1.5 shadow-sm active:scale-[0.98] transition-transform",
                ),
                h.OnClick(Message.ClickedEndSession()),
              ],
              [h.span([h.Class("text-sm")], ["■"]), "End"],
            ),
            h.div(
              [h.Class("flex gap-2")],
              [
                h.button(
                  [
                    h.Class(
                      "btn btn-sm rounded-full bg-error/10 backdrop-blur-md border border-error/20 text-error hover:bg-error hover:text-white gap-1.5 shadow-sm active:scale-[0.98]",
                    ),
                    h.OnClick(Message.ClickedCancelEdit()),
                  ],
                  ["Cancel"],
                ),
                h.button(
                  [
                    h.Class(
                      "btn btn-sm rounded-full bg-success text-white border border-success gap-1.5 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:bg-base-300 disabled:text-base-content/40 disabled:border-base-300",
                    ),
                    h.Disabled(!canSave),
                    h.OnClick(Message.ClickedSaveEdit()),
                  ],
                  ["Save"],
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  return h.div(
    [
      h.Class(
        "fixed inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2",
      ),
    ],
    [
      h.button(
        [
          h.Class(
            "btn btn-sm rounded-full bg-error/10 backdrop-blur-md border border-error/20 text-error hover:bg-error hover:text-white gap-1.5 shadow-sm active:scale-[0.98] transition-transform",
          ),
          h.OnClick(Message.ClickedEndSession()),
        ],
        [h.span([h.Class("text-sm")], ["■"]), "End"],
      ),
      h.button(
        [
          h.Class(
            `btn btn-sm rounded-full gap-1.5 shadow-sm active:scale-[0.98] transition-colors ${
              canRecord
                ? "bg-success text-white border border-success hover:bg-success/90"
                : "bg-base-300 text-base-content/40 border border-base-300 cursor-not-allowed"
            }`,
          ),
          h.Disabled(!canRecord),
          h.OnClick(Message.ClickedRecord()),
        ],
        ["Record"],
      ),
    ],
  );
};

// ── FormEntry (phone sheet row) ─────────────────────────────────────────────

const taskStateIndicator = (task: RunnerTask, h: HtmlBuilder<Message>) => {
  const state = task.endDate === null ? "current" : task.isBeingEdited ? "editable" : "done";
  if (state === "current") {
    return h.div(
      [
        h.Class("relative flex items-center justify-center shrink-0"),
        h.Attribute("style", "width:20px;height:20px"),
      ],
      [
        h.div([h.Class("absolute inset-0 rounded-full bg-success")], []),
        h.div(
          [
            h.Class("absolute rounded-full border-2 border-success/30"),
            h.Attribute("style", "inset:-3px"),
          ],
          [],
        ),
      ],
    );
  }
  if (state === "editable") {
    return h.div(
      [
        h.Class(
          "flex h-5 w-5 items-center justify-center rounded-full bg-warning text-white text-[10px] font-bold shrink-0",
        ),
      ],
      ["✎"],
    );
  }
  // done
  return h.div(
    [
      h.Class(
        "flex h-5 w-5 items-center justify-center rounded-full bg-base-300 text-base-content/60 shrink-0",
      ),
    ],
    [checkIcon("h-3 w-3", h)],
  );
};

const formEntry = (task: RunnerTask, isSelected: boolean, h: HtmlBuilder<Message>) => {
  const timeLabel =
    taskStartDate(task) !== null ? formatTimeOnly(taskStartDate(task) as number) : null;
  const duration = (() => {
    const start = taskStartDate(task);
    const end = task.endDate;
    if (start !== null && end !== null) return formatDurationHms(end - start);
    return null;
  })();

  // Show up to 4-line preview
  const previewSections = [...task.sections].sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 4);

  return h.div(
    [
      h.Class(
        `flex gap-3 rounded-box p-3.5 transition-all duration-150 border ${
          isSelected
            ? "bg-primary/10 border-primary/40 shadow-xs"
            : "bg-base-100 border-base-300 shadow-xs hover:border-base-300/80"
        }`,
      ),
    ],
    [
      taskStateIndicator(task, h),
      h.div(
        [h.Class("flex min-w-0 flex-1 flex-col gap-1.5")],
        [
          h.div(
            [h.Class("flex items-center justify-between gap-2")],
            [
              h.span(
                [
                  h.Class(
                    `truncate text-sm ${isSelected ? "font-bold text-primary" : "font-semibold text-base-content"}`,
                  ),
                ],
                [`Task ${task.orderIndex}`],
              ),
              ...(timeLabel
                ? [
                    h.span(
                      [h.Class("shrink-0 text-xs font-mono text-base-content/60")],
                      [timeLabel],
                    ),
                  ]
                : []),
            ],
          ),
          ...(duration
            ? [
                h.div(
                  [h.Class("flex items-center gap-1 text-xs font-mono text-base-content/60")],
                  [clockTinyIcon("h-3 w-3", h), h.span([], [duration])],
                ),
              ]
            : []),
          ...(previewSections.length > 0
            ? [
                h.div(
                  [h.Class("flex flex-col gap-1 pt-1 border-t border-base-200/60")],
                  previewSections.map((s) => {
                    const hasValue = s.value !== "";
                    const displayVal =
                      s.kind === "boolean" && hasValue
                        ? isBooleanTrue(s.value)
                          ? "Yes / Active"
                          : "No / Off"
                        : s.value;
                    return h.div(
                      [h.Class("flex items-baseline gap-2 text-xs")],
                      [
                        h.span(
                          [h.Class("min-w-[60px] shrink-0 text-base-content/50 font-medium")],
                          [s.name],
                        ),
                        h.span(
                          [
                            h.Class(
                              `truncate ${hasValue ? "text-base-content" : "text-base-content/40 italic"}`,
                            ),
                          ],
                          [hasValue ? displayVal : "—"],
                        ),
                      ],
                    );
                  }),
                ),
              ]
            : []),
        ],
      ),
    ],
  );
};

// ── Task list sheet ─────────────────────────────────────────────────────────

const taskListSheet = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const sorted = [...runner.tasks].sort((a, b) => b.orderIndex - a.orderIndex);
  const curId = currentTask(runner)?.id ?? runner.currentTaskId;
  return h.div(
    [
      h.Class("fixed inset-0 z-40 flex flex-col bg-base-200 animate-[slide-up_0.25s_ease-out]"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
      h.AriaLabel("Tasks"),
    ],
    [
      // header
      h.div(
        [
          h.Class(
            "flex flex-col border-b border-base-300 bg-base-100 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-3 shrink-0 shadow-xs",
          ),
        ],
        [
          h.div([h.Class("mx-auto h-1 w-10 rounded-full bg-base-content/20 mb-2")], []),
          h.div(
            [h.Class("flex items-center justify-between")],
            [
              h.div(
                [h.Class("flex items-center gap-2")],
                [
                  h.h2([h.Class("text-base font-bold text-base-content")], ["Tasks"]),
                  h.span(
                    [h.Class("badge badge-sm badge-neutral font-mono")],
                    [`${runner.completedCount} completed`],
                  ),
                ],
              ),
              h.button(
                [
                  h.Class("btn btn-primary btn-sm rounded-field font-semibold px-4 shadow-xs"),
                  h.OnClick(Message.ToggledTaskList()),
                  h.AriaLabel("Done"),
                ],
                ["Done"],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            "flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-2.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          ),
        ],
        sorted.map((task) =>
          h.button(
            [
              h.Class("w-full text-left rounded-box focus-visible:outline-none"),
              h.OnClick(Message.ClickedSelectTask({ taskId: task.id })),
              h.AriaLabel(
                `Task ${task.orderIndex} ${task.endDate === null ? "in progress" : task.isBeingEdited ? "editing" : "completed"}`,
              ),
            ],
            [formEntry(task, task.id === curId, h)],
          ),
        ),
      ),
    ],
  );
};

// ── End confirmation modal ──────────────────────────────────────────────────

export const endConfirmModal = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const elapsed = formatClock(Math.max(0, runner.now - runner.startedAt));
  const count = runner.completedCount;
  const message =
    count === 0
      ? `Are you sure you want to end this session? You have recorded 0 tasks in ${elapsed}. No session will be saved.`
      : `Are you sure you want to end this session? You have recorded ${count} task(s) in ${elapsed}.`;
  return h.div(
    [h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs")],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 bg-base-100 p-5")],
        [
          h.h3([h.Class("text-base font-bold")], ["End Session"]),
          h.p([h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")], [message]),
          h.div(
            [h.Class("modal-action mt-5 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedEndSession()),
                ],
                ["End Session"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledEndSession()),
                ],
                ["Cancel"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledEndSession())], []),
    ],
  );
};

export const errorAlert = (msg: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs")],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 bg-base-100 p-5")],
        [
          h.h3([h.Class("text-base font-bold")], ["Something Went Wrong"]),
          h.p([h.Class("mt-1.5 text-xs text-base-content/70")], [msg]),
          h.div(
            [h.Class("modal-action mt-4")],
            [
              h.button(
                [
                  h.Class("btn btn-primary btn-block rounded-field"),
                  h.OnClick(Message.DismissedRunnerError()),
                ],
                ["OK"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.DismissedRunnerError())], []),
    ],
  );

// ── Public entry ────────────────────────────────────────────────────────────

type RunnerModel = {
  readonly runner: RunnerState | null;
};

export const runnerView = (model: RunnerModel, h: HtmlBuilder<Message>) => {
  const runner = model.runner;
  if (runner === null) {
    return h.div(
      [h.Class("flex h-full flex-col items-center justify-center p-8 text-center")],
      [
        h.div([h.Class("loading loading-spinner loading-sm text-base-content/40")], []),
        h.p([h.Class("mt-3 text-sm text-base-content/60")], ["Loading session…"]),
      ],
    );
  }

  // Find current task (for canvas)
  const task = currentTask(runner);
  if (task === null) {
    return h.div(
      [h.Class("flex h-full items-center justify-center p-8 text-center")],
      [h.p([h.Class("text-sm text-base-content/50")], ["No task found for this session."])],
    );
  }

  const headerRow = h.div(
    [
      h.Class(
        "sticky top-0 z-20 flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-2 pt-[env(safe-area-inset-top)] shrink-0",
      ),
    ],
    [
      sessionTimerView(runner, h),
      h.button(
        [
          h.Class(
            "flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-3 py-1.5 text-xs font-medium text-base-content shadow-sm active:scale-[0.98] transition-transform",
          ),
          h.OnClick(Message.ToggledTaskList()),
          h.AriaLabel("Show task list"),
        ],
        [
          h.span([h.Class("font-mono font-semibold")], [`${runner.completedCount}`]),
          listBulletIcon("h-4 w-4", h),
        ],
      ),
    ],
  );

  const scrollCanvas = h.div(
    [h.Class("flex-1 overflow-y-auto overscroll-y-contain bg-base-200")],
    [h.div([h.Class("mx-auto w-full max-w-xl pb-28")], [formSectionsView(runner, task, h)])],
  );

  return h.div(
    [
      h.Class(
        "flex h-[100dvh] w-full flex-col overflow-hidden bg-base-200 text-base-content relative",
      ),
    ],
    [
      headerRow,
      scrollCanvas,
      bottomFadeGradient(h),
      sessionBottomBar(runner, task, h),
      ...(runner.showTaskList ? [taskListSheet(runner, h)] : []),
      ...(runner.showEndConfirm ? [endConfirmModal(runner, h)] : []),
      ...(runner.lastError !== null ? [errorAlert(runner.lastError, h)] : []),
    ],
  );
};
