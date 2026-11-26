import type { H } from "@/lib/view";

import { groupedList, navBarAction, sectionHeader } from "@/components/app";
import { Message } from "../../../messages";
import { currentTask, type RunnerState } from "./runner";
import {
  runnerActionBar,
  runnerCanvas,
  runnerEmptyTaskView,
  runnerLoadingView,
  runnerNavBar,
  taskRows,
} from "./runnerView";
import { taskCountLabel, taskCountName } from "./runnerStatus";

// The tablet and desktop screen is the phone screen with the task list pinned
// as a right-hand panel instead of a side sheet: same nav bar, form and action
// bar. The nav bar spans the whole width, and on wide screens the form keeps
// a matching gutter on its left, so the session stays centred in the window.

const sidebarToggle = (runner: RunnerState, h: H<Message>) =>
  navBarAction(
    {
      label: taskCountLabel(runner, h),
      onClick: Message.ToggledSidebar(),
      ariaLabel: taskCountName(runner, runner.showSidebar ? "collapse sidebar" : "expand sidebar"),
      attrs: {
        "aria-expanded": String(runner.showSidebar),
        "aria-controls": "runner-task-sidebar",
      },
    },
    h,
  );

const taskSidebar = (runner: RunnerState, h: H<Message>) =>
  h.aside
    .class(
      `flex shrink-0 flex-col overflow-hidden border-l border-border/70 bg-card/60 transition-[width] duration-200 ${
        runner.showSidebar ? "w-72" : "w-0 border-l-0"
      }`,
    )
    .attr("aria-label", "Task navigation sidebar")
    .id("runner-task-sidebar")
    .attr("inert", runner.showSidebar ? undefined : "")
    .children(
      h.div
        .class("flex w-72 shrink-0 items-center px-4 pt-4")
        .children(sectionHeader(`Tasks · ${runner.completedCount} recorded`, h, "pb-0")),
      h.div
        .class("min-h-0 w-72 flex-1 overflow-y-auto overscroll-y-contain px-4 pt-3 pb-6")
        .attr("data-runner-layout", "")
        .children(groupedList({}, [...taskRows(runner, h, { showValue: false })], h)),
    );

export const sessionTabletView = (runner: RunnerState | null, h: H<Message>) => {
  if (runner === null) return runnerLoadingView(h);
  const task = currentTask(runner);
  if (task === null) return runnerEmptyTaskView(h);

  return h.div
    .class("flex h-full min-h-0 w-full flex-col bg-background text-foreground")
    .attr("data-runner-layout", "")
    .children(
      runnerNavBar(runner, { trailing: [sidebarToggle(runner, h)] }, h),
      h.div
        .class("flex min-h-0 min-w-0 flex-1")
        .attr("data-runner-layout", "")
        .children(
          h.section
            .class(
              `flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-200 ${
                runner.showSidebar ? "xl:pl-72" : ""
              }`,
            )
            .attr("aria-label", "Task answers")
            .attr("data-runner-layout", "")
            .children(
              runnerCanvas({ runner, task, scope: "tablet" }, h),
              runnerActionBar({ runner, task, scope: "tablet" }, h),
            ),
          taskSidebar(runner, h),
        ),
    );
};
