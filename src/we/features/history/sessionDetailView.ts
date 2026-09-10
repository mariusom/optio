import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Download,
  Pencil,
  confirmSheet,
  groupedList,
  icon,
  navBar,
  navBarAction,
  notice,
  page,
  row,
} from "@/components/app";
import { Message } from "../../../messages";
import { formatDurationHm, formatDurationHms, formatTimeOnly } from "../../format";
import { hrefFor } from "../../routes";
import { editSessionNameSheet } from "./editSessionNameSheet";
import { formatAnswer, formatDay, taskCountLabel } from "./helpers";
import { taskDetailView } from "./taskDetailView";

type SessionDetailTask = {
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

type SessionDetailModel = {
  readonly selectedHistorySession: {
    readonly id: string;
    readonly sessionName: string;
    readonly templateName: string;
    readonly startedAt: number;
    readonly endedAt: number | null;
    readonly taskCount: number;
    readonly tasks: ReadonlyArray<SessionDetailTask>;
  } | null;
  readonly showEditHistoryName: boolean;
  readonly editHistoryNameInput: string;
  readonly selectedHistoryTaskId: string | null;
  readonly pendingHistoryDelete: { readonly id: string; readonly displayName: string } | null;
  readonly csvError: string | null;
};

/** First two answers, so the row says what the task was without opening it. */
const taskSubtitle = (task: SessionDetailTask): string | undefined => {
  const answered = task.sections.filter((section) => section.value !== "");
  if (answered.length === 0) return undefined;
  return answered
    .slice(0, 2)
    .map((section) => `${section.sectionName}: ${formatAnswer(section.sectionType, section.value)}`)
    .join(" · ");
};

const taskRow = (task: SessionDetailTask, h: HtmlBuilder<Message>): Html => {
  const subtitle = taskSubtitle(task);
  const duration =
    task.startedAt !== null && task.endedAt !== null
      ? formatDurationHms(task.endedAt - task.startedAt)
      : undefined;
  return row(
    {
      title: `Task ${task.taskId}`,
      ...(subtitle === undefined ? {} : { subtitle }),
      ...(duration === undefined ? {} : { value: duration }),
      onClick: Message.ClickedHistoryTask({ taskId: task.id }),
      chevron: true,
      lazy: true,
      attributes: [h.AriaLabel(`View details for Task ${task.taskId}`)],
    },
    h,
  );
};

export const sessionDetailPage = (model: SessionDetailModel, h: HtmlBuilder<Message>) => {
  const detail = model.selectedHistorySession;
  const backHref = hrefFor({ _tag: "HistoryTab" });

  if (detail === null) {
    return h.div(
      [h.Class("flex min-h-full flex-col")],
      [
        navBar({ title: "Session", back: { href: backHref, label: "History" } }, h),
        page(
          {},
          [
            ...(model.csvError === null
              ? []
              : [
                  notice(
                    {
                      tone: "error",
                      text: model.csvError,
                      onDismiss: Message.DismissedCsvError(),
                      dismissLabel: "Dismiss error",
                    },
                    h,
                  ),
                ]),
            h.p(
              [h.Class("pt-8 text-center text-sm text-muted-foreground")],
              ["Opening this session…"],
            ),
          ],
          h,
        ),
      ],
    );
  }

  const displayName = detail.sessionName !== "" ? detail.sessionName : detail.templateName;
  const duration =
    detail.endedAt !== null ? formatDurationHm(detail.endedAt - detail.startedAt) : null;
  const sortedTasks = [...detail.tasks].sort((a, b) => a.taskId - b.taskId);
  const selectedTask =
    model.selectedHistoryTaskId !== null
      ? (detail.tasks.find((task) => task.id === model.selectedHistoryTaskId) ?? null)
      : null;
  const canExport = detail.endedAt !== null && detail.taskCount > 0;

  return h.div(
    [h.Class("flex min-h-full flex-col")],
    [
      navBar(
        {
          title: displayName,
          back: { href: backHref, label: "History" },
          trailing: [
            navBarAction(
              {
                label: icon(h, Download, "size-5"),
                onClick: Message.ClickedExportHistoryCsv({
                  sessionId: detail.id,
                  spreadsheetSafe: true,
                }),
                isDisabled: !canExport,
                ariaLabel: `Export ${displayName}`,
              },
              h,
            ),
            navBarAction(
              {
                label: icon(h, Pencil, "size-5"),
                onClick: Message.ClickedEditHistoryName(),
                ariaLabel: "Edit session name",
              },
              h,
            ),
          ],
        },
        h,
      ),
      page(
        { className: "pt-4" },
        [
          ...(model.csvError === null
            ? []
            : [
                notice(
                  {
                    tone: "error",
                    text: model.csvError,
                    onDismiss: Message.DismissedCsvError(),
                    dismissLabel: "Dismiss error",
                  },
                  h,
                ),
              ]),
          groupedList(
            { header: "Summary", footer: formatDay(detail.startedAt) },
            [
              row({ title: "Template", value: detail.templateName }, h),
              row({ title: "Started", value: formatTimeOnly(detail.startedAt) }, h),
              ...(detail.endedAt === null
                ? []
                : [row({ title: "Ended", value: formatTimeOnly(detail.endedAt) }, h)]),
              ...(duration === null ? [] : [row({ title: "Duration", value: duration }, h)]),
              row({ title: "Tasks", value: taskCountLabel(detail.taskCount) }, h),
            ],
            h,
          ),
          groupedList(
            {
              header: "Tasks",
              ...(sortedTasks.length === 0 ? {} : { footer: "Tap a task to see every answer." }),
            },
            sortedTasks.length === 0
              ? [row({ title: "No tasks were recorded." }, h)]
              : sortedTasks.map((task) => taskRow(task, h)),
            h,
          ),
          groupedList(
            {},
            [
              row(
                {
                  title: "Delete session",
                  destructive: true,
                  onClick: Message.RequestedHistoryDelete({
                    id: detail.id,
                    displayName,
                  }),
                  chevron: false,
                  attributes: [h.AriaLabel(`Delete ${displayName}`)],
                },
                h,
              ),
            ],
            h,
          ),
        ],
        h,
      ),
      ...(selectedTask === null ? [] : [taskDetailView({ task: selectedTask }, h)]),
      editSessionNameSheet(
        {
          showEditHistoryName: model.showEditHistoryName,
          editHistoryNameInput: model.editHistoryNameInput,
          selectedHistorySession: detail,
        },
        h,
      ),
      ...(model.pendingHistoryDelete === null
        ? []
        : [
            confirmSheet(
              {
                id: "delete-session-detail",
                title: "Delete this session?",
                message: `“${model.pendingHistoryDelete.displayName}” and everything recorded in it will be deleted. This can’t be undone.`,
                confirmLabel: "Delete",
                confirmAriaLabel: "Confirm delete",
                cancelAriaLabel: "Cancel delete",
                dismissLabel: "Cancel deleting session",
                destructive: true,
                onConfirm: Message.ConfirmedHistoryDelete(),
                onCancel: Message.CanceledHistoryDelete(),
              },
              h,
            ),
          ]),
    ],
  );
};
