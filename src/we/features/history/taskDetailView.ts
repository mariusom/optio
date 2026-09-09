import type { HtmlBuilder } from "foldkit/html";

import { groupedList, row, sheet } from "@/components/app";
import { button } from "@/components/ui/button";
import { Message } from "../../../messages";
import { formatDurationHms, formatTimeOnly } from "../../format";
import { formatAnswer } from "./helpers";

export type TaskDetailModel = {
  readonly task: {
    readonly id: string;
    readonly taskId: number;
    readonly startedAt: number | null;
    readonly endedAt: number | null;
    readonly sections: ReadonlyArray<{
      readonly sectionName: string;
      readonly value: string;
      readonly sectionType: string;
      readonly isRequired: boolean;
      readonly startedAt: number | null;
    }>;
  };
};

/** "9:41 AM → 9:44 AM · 3m 12s" — when the task was recorded. */
const whenText = (startedAt: number | null, endedAt: number | null): string | undefined => {
  if (startedAt === null && endedAt === null) return undefined;
  const range = [startedAt, endedAt]
    .filter((value): value is number => value !== null)
    .map(formatTimeOnly)
    .join(" → ");
  return startedAt !== null && endedAt !== null
    ? `${range} · ${formatDurationHms(endedAt - startedAt)}`
    : range;
};

export const taskDetailView = (model: TaskDetailModel, h: HtmlBuilder<Message>) => {
  const task = model.task;
  const when = whenText(task.startedAt, task.endedAt);

  return sheet(
    {
      id: "history-task",
      title: `Task ${task.taskId}`,
      ...(when === undefined ? {} : { description: when }),
      onDismiss: Message.DismissedHistoryTask(),
      dismissLabel: `Close Task ${task.taskId}`,
      size: "md",
      footer: [
        button(
          {
            size: "lg",
            onClick: Message.DismissedHistoryTask(),
            attributes: [h.AriaLabel("Done")],
          },
          "Done",
          h,
        ),
      ],
    },
    [
      task.sections.length === 0
        ? h.p(
            [h.Class("px-1 py-6 text-center text-sm text-muted-foreground")],
            ["Nothing was answered for this task."],
          )
        : groupedList(
            { header: "Answers" },
            task.sections.map((section) =>
              row(
                {
                  title: section.sectionName,
                  value: formatAnswer(section.sectionType, section.value),
                  wrap: true,
                  lazy: true,
                },
                h,
              ),
            ),
            h,
          ),
    ],
    h,
  );
};
