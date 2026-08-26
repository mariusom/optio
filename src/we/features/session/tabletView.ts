import { svgIcon } from "../../ui";
import type { HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import { formatDurationHms, formatTimeOnly } from "../../format";
import { currentTask, taskStartDate, type RunnerState, type RunnerTask } from "./runner";
import { formSectionsView, sessionTimerView, endConfirmModal, errorAlert } from "./runnerView";

// ── Icons ───────────────────────────────────────────────────────────────────

const sidebarLeftIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(
    classes,
    h,
    [
      h.rect(
        [
          h.Attribute("x", "3"),
          h.Attribute("y", "4"),
          h.Attribute("width", "18"),
          h.Attribute("height", "16"),
          h.Attribute("rx", "2"),
        ],
        [],
      ),
      h.line(
        [
          h.Attribute("x1", "9"),
          h.Attribute("y1", "4"),
          h.Attribute("x2", "9"),
          h.Attribute("y2", "20"),
        ],
        [],
      ),
      h.line(
        [
          h.Attribute("x1", "5.5"),
          h.Attribute("y1", "8"),
          h.Attribute("x2", "7.5"),
          h.Attribute("y2", "8"),
        ],
        [],
      ),
      h.line(
        [
          h.Attribute("x1", "5.5"),
          h.Attribute("y1", "12"),
          h.Attribute("x2", "7.5"),
          h.Attribute("y2", "12"),
        ],
        [],
      ),
      h.line(
        [
          h.Attribute("x1", "5.5"),
          h.Attribute("y1", "16"),
          h.Attribute("x2", "7.5"),
          h.Attribute("y2", "16"),
        ],
        [],
      ),
    ],
    "1.8",
  );

const checkIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [h.polyline([h.Attribute("points", "20 6 9 17 4 12")], [])], "2.5");

const pencilIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(
    classes,
    h,
    [
      h.path([h.Attribute("d", "M12 20h9")], []),
      h.path([h.Attribute("d", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z")], []),
    ],
    "1.8",
  );

const clockTinyIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.polyline([h.Attribute("points", "12 7 12 12 15 15")], []),
  ]);

// ── Sidebar state indicator (16pt) ──────────────────────────────────────────

const sidebarStateIndicator = (task: RunnerTask, h: HtmlBuilder<Message>) => {
  const state = task.endDate === null ? "current" : task.isBeingEdited ? "editable" : "done";
  if (state === "current") {
    // solid green circle 16pt
    return h.div(
      [h.Class("h-4 w-4 shrink-0 rounded-full bg-success"), h.Attribute("aria-hidden", "true")],
      [],
    );
  }
  if (state === "editable") {
    // orange pencil.circle.fill — orange circle with pencil glyph
    return h.div(
      [
        h.Class(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning text-white",
        ),
      ],
      [pencilIcon("h-2.5 w-2.5", h)],
    );
  }
  // done: secondary checkmark.circle.fill
  return h.div(
    [
      h.Class(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary text-white",
      ),
    ],
    [checkIcon("h-2.5 w-2.5", h)],
  );
};

// ── SidebarTaskListView ─────────────────────────────────────────────────────

const sidebarTaskListView = (runner: RunnerState, h: HtmlBuilder<Message>) => {
  const sorted = [...runner.tasks].sort((a, b) => b.orderIndex - a.orderIndex);
  const curId = currentTask(runner)?.id ?? runner.currentTaskId;
  return h.div(
    [h.Class("flex flex-col gap-1")],
    sorted.map((task) => {
      const isSelected = task.id === curId;
      const timeLabel =
        taskStartDate(task) !== null ? formatTimeOnly(taskStartDate(task) as number) : null;
      const duration = (() => {
        const start = taskStartDate(task);
        const end = task.endDate;
        if (start !== null && end !== null) return formatDurationHms(end - start);
        return null;
      })();
      return h.button(
        [
          h.Class("w-full text-left"),
          h.OnClick(Message.ClickedSelectTask({ taskId: task.id })),
          h.AriaLabel(
            `Task ${task.orderIndex} ${task.endDate === null ? "in progress" : task.isBeingEdited ? "editing" : "completed"}`,
          ),
        ],
        [
          h.div(
            [
              h.Class(
                `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors border ${
                  isSelected
                    ? "bg-accent/15 border-accent/35"
                    : "bg-transparent border-transparent hover:bg-base-200"
                }`,
              ),
            ],
            [
              sidebarStateIndicator(task, h),
              h.div(
                [h.Class("flex min-w-0 flex-1 flex-col")],
                [
                  h.div(
                    [h.Class("flex items-baseline gap-2")],
                    [
                      h.span(
                        [
                          h.Class(
                            `truncate text-sm ${isSelected ? "font-semibold text-base-content" : "font-medium text-base-content"}`,
                          ),
                        ],
                        [`Task ${task.orderIndex}`],
                      ),
                      ...(timeLabel
                        ? [h.span([h.Class("shrink-0 text-xs text-base-content/60")], [timeLabel])]
                        : []),
                    ],
                  ),
                  ...(duration
                    ? [
                        h.div(
                          [h.Class("flex items-center gap-1 text-xs text-base-content/60")],
                          [clockTinyIcon("h-3 w-3", h), h.span([], [duration])],
                        ),
                      ]
                    : []),
                ],
              ),
              // trailing duration already shown; keep right-aligned duration as caption2 alternative
              // (duplicate removed — duration shown inside column)
            ],
          ),
        ],
      );
    }),
  );
};

// ── Tablet BottomFade & BottomBar (scoped absolute inside section) ───────────

const tabletBottomFadeGradient = (h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        "pointer-events-none absolute inset-x-0 bottom-0 h-[calc(180px+env(safe-area-inset-bottom))] bg-gradient-to-t from-base-200 via-base-200/80 to-transparent",
      ),
      h.Attribute("aria-hidden", "true"),
    ],
    [],
  );

const tabletSessionBottomBar = (
  runner: RunnerState,
  task: RunnerTask | null,
  h: HtmlBuilder<Message>,
) => {
  if (task === null) return h.div([], []);
  const isEditing = task.isBeingEdited;
  const canRecord = task.sections.every((s) => (s.isRequired ? s.value !== "" : true));
  const canSave = isEditing ? canRecord : true;

  // Absolute inside section: bottom-0 inset-x-0, pb includes safe-area on md
  const outerClass =
    "absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2";
  if (isEditing) {
    return h.div(
      [h.Class(outerClass)],
      [
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
    [h.Class(outerClass)],
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

// ── SessionTabletView ───────────────────────────────────────────────────────

export const sessionTabletView = (runner: RunnerState | null, h: HtmlBuilder<Message>) => {
  if (runner === null) {
    return h.div(
      [h.Class("flex h-full flex-col items-center justify-center p-8 text-center")],
      [
        h.div([h.Class("loading loading-spinner loading-sm text-base-content/40")], []),
        h.p([h.Class("mt-3 text-sm text-base-content/60")], ["Loading session…"]),
      ],
    );
  }
  const task = currentTask(runner);
  if (task === null) {
    return h.div(
      [h.Class("flex h-full items-center justify-center p-8 text-center")],
      [h.p([h.Class("text-sm text-base-content/50")], ["No task found for this session."])],
    );
  }

  const headerBar = h.header(
    [
      h.Class(
        "flex items-center justify-between bg-base-100 border-b border-base-300 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 shrink-0",
      ),
    ],
    [
      h.div(
        [h.Class("flex items-center gap-2 min-w-0")],
        [
          h.button(
            [
              h.Class(
                "btn btn-ghost btn-xs h-7 min-h-0 px-2 gap-1.5 rounded-field text-base-content hover:bg-base-200 active:scale-[0.97]",
              ),
              h.OnClick(Message.ToggledSidebar()),
              h.AriaLabel("Toggle sidebar"),
            ],
            [sidebarLeftIcon("h-3.5 w-3.5", h)],
          ),
          ...(!runner.showSidebar
            ? [
                h.span(
                  [h.Class("text-xs font-medium text-base-content/70 font-mono")],
                  [`${runner.completedCount} recorded`],
                ),
              ]
            : []),
        ],
      ),
      sessionTimerView(runner, h),
    ],
  );

  const sidebar = h.aside(
    [
      h.Class(
        `bg-base-100 border-r border-base-300 flex flex-col shrink-0 overflow-hidden transition-all duration-250 ease-in-out ${runner.showSidebar ? "translate-x-0 w-80 lg:w-96" : "-translate-x-full w-0 overflow-hidden border-r-0"}`,
      ),
      h.Attribute("style", "transition: transform 0.25s ease-in-out, width 0.25s ease-in-out"),
    ],
    [
      h.div(
        [
          h.Class(
            "flex items-center justify-between px-3 py-2.5 border-b border-base-200 shrink-0",
          ),
        ],
        [
          h.h2([h.Class("text-sm font-semibold text-base-content")], ["Tasks"]),
          h.span(
            [h.Class("text-xs font-mono text-base-content/60")],
            [`${runner.completedCount} recorded`],
          ),
        ],
      ),
      h.div(
        [h.Class("flex-1 overflow-y-auto overscroll-y-contain p-2")],
        [sidebarTaskListView(runner, h)],
      ),
    ],
  );

  const mainSection = h.section(
    [
      h.Class(
        "flex-1 overflow-y-auto overscroll-y-contain bg-base-200 p-6 flex justify-center relative",
      ),
    ],
    [
      h.div([h.Class("w-full max-w-xl pb-24")], [formSectionsView(runner, task, h)]),
      tabletBottomFadeGradient(h),
      tabletSessionBottomBar(runner, task, h),
    ],
  );

  return h.div(
    [h.Class("h-dvh w-full flex flex-col bg-base-200 overflow-hidden text-base-content relative")],
    [
      headerBar,
      h.div([h.Class("flex-1 flex overflow-hidden")], [sidebar, mainSection]),
      // overlays that should be global (modals)
      ...(runner.showEndConfirm ? [endConfirmModal(runner, h)] : []),
      ...(runner.lastError !== null ? [errorAlert(runner.lastError, h)] : []),
    ],
  );
};
