import type { HtmlBuilder } from "foldkit/html";

import { List, groupedList, icon, navBarAction, sectionHeader } from "@/components/app";
import { Message } from "../../../messages";
import { currentTask, type RunnerState } from "./runner";
import {
  endConfirmModal,
  runnerActionBar,
  runnerCanvas,
  runnerEmptyTaskView,
  runnerLoadingView,
  runnerNavBar,
  taskRows,
} from "./runnerView";

// The tablet screen is the phone screen with the task list pinned open as a
// column instead of a sheet: same nav bar, same form, same action bar.

const sidebarToggle = (runner: RunnerState, h: HtmlBuilder<Message>) =>
  navBarAction(
    {
      label: h.span(
        [h.Class("flex items-center gap-1.5")],
        [icon(h, List, "size-5"), h.span([h.Class("tabular")], [`${runner.completedCount}`])],
      ),
      onClick: Message.ToggledSidebar(),
      ariaLabel: runner.showSidebar ? "Collapse sidebar" : "Expand sidebar",
      attributes: [h.AriaExpanded(runner.showSidebar), h.AriaControls("runner-task-sidebar")],
    },
    h,
  );

const taskSidebar = (runner: RunnerState, h: HtmlBuilder<Message>) =>
  h.aside(
    [
      h.Class(
        `flex shrink-0 flex-col overflow-hidden border-r border-border/70 bg-card/40 transition-all duration-200 ${
          runner.showSidebar ? "w-72" : "w-0 border-r-0"
        }`,
      ),
      h.AriaLabel("Task navigation sidebar"),
      h.Id("runner-task-sidebar"),
      ...(runner.showSidebar ? [] : [h.Attribute("inert", "")]),
    ],
    [
      h.div(
        [h.Class("flex w-72 shrink-0 items-center px-3 pt-safe pb-2")],
        [sectionHeader(`Tasks · ${runner.completedCount} recorded`, h, "pt-4 pb-0")],
      ),
      h.div(
        [h.Class("min-h-0 w-72 flex-1 overflow-y-auto overscroll-y-contain px-3 pt-4 pb-6")],
        [groupedList({}, [...taskRows(runner, h, { showValue: false })], h)],
      ),
    ],
  );

export const sessionTabletView = (runner: RunnerState | null, h: HtmlBuilder<Message>) => {
  if (runner === null) return runnerLoadingView(h);
  const task = currentTask(runner);
  if (task === null) return runnerEmptyTaskView(h);

  return h.div(
    [h.Class("flex h-full min-h-0 w-full bg-background text-foreground")],
    [
      taskSidebar(runner, h),
      h.div(
        [h.Class("flex min-h-0 min-w-0 flex-1 flex-col")],
        [
          runnerNavBar(runner, [sidebarToggle(runner, h)], h),
          h.section(
            [h.Class("flex min-h-0 min-w-0 flex-1 flex-col"), h.AriaLabel("Task answers")],
            [runnerCanvas(runner, task, "tablet", h), runnerActionBar(runner, task, h)],
          ),
        ],
      ),
      ...(runner.showEndConfirm ? [endConfirmModal(runner, h)] : []),
    ],
  );
};
