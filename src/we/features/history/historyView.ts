import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Download,
  Ellipsis,
  History,
  Trash2,
  confirmSheet,
  emptyState,
  groupedList,
  icon,
  notice,
  page,
  row,
  sheet,
  sheetAction,
} from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { Message } from "../../../messages";
import { formatDurationHm, formatTimeOnly } from "../../format";
import { hrefFor } from "../../routes";
import { groupByDay, taskCountLabel } from "./helpers";

type HistorySession = {
  readonly id: string;
  readonly displayName: string;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly taskCount: number;
};

type HistoryModel = {
  readonly history: ReadonlyArray<HistorySession>;
  readonly pendingHistoryDelete: { readonly id: string; readonly displayName: string } | null;
  readonly historyActionsFor: string | null;
  readonly csvError: string | null;
};

// ── One session ───────────────────────────────────────────────────────────

const summaryFor = (session: HistorySession): string =>
  [
    session.templateName,
    taskCountLabel(session.taskCount),
    formatDurationHm(session.endedAt - session.startedAt),
  ].join(" · ");

/**
 * A tappable row plus its own "⋯" button. The two controls sit side by side
 * inside one list cell — a button can't be nested inside the row's button.
 */
const sessionRow = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("flex items-stretch")],
    [
      row(
        {
          title: session.displayName,
          subtitle: summaryFor(session),
          value: h.span([h.Class("text-sm")], [formatTimeOnly(session.startedAt)]),
          onClick: Message.ClickedHistoryRow({ id: session.id }),
          chevron: true,
          lazy: true,
          className: "min-w-0 flex-1",
          attributes: [h.AriaLabel(`Open session ${session.displayName}`)],
        },
        h,
      ),
      button(
        {
          variant: "ghost",
          size: "icon",
          className: "self-center",
          attributes: [h.AriaLabel(`Actions for "${session.displayName}"`)],
          onClick: Message.OpenedHistoryActions({ id: session.id }),
        },
        [icon(h, Ellipsis, "size-5")],
        h,
      ),
    ],
  );

// ── Action sheet: Export / Delete ─────────────────────────────────────────

const actionsSheet = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  sheet(
    {
      id: "history-actions",
      title: session.displayName,
      description: summaryFor(session),
      onDismiss: Message.ClosedHistoryActions(),
      dismissLabel: "Close actions",
      footer: [
        button(
          {
            variant: "secondary",
            size: "lg",
            onClick: Message.ClosedHistoryActions(),
            attributes: [h.AriaLabel("Cancel actions")],
          },
          "Cancel",
          h,
        ),
      ],
    },
    [
      h.div(
        [h.Class("flex flex-col")],
        [
          sheetAction(
            {
              label: "Export",
              leading: icon(h, Download, "size-5 text-muted-foreground"),
              isDisabled: session.taskCount === 0,
              onClick: Message.ClickedExportHistoryCsv({ sessionId: session.id }),
              ariaLabel: `Export ${session.displayName}`,
            },
            h,
          ),
          sheetAction(
            {
              label: "Delete",
              destructive: true,
              leading: icon(h, Trash2, "size-5"),
              onClick: Message.RequestedHistoryDelete({
                id: session.id,
                displayName: session.displayName,
              }),
              ariaLabel: `Delete ${session.displayName}`,
            },
            h,
          ),
        ],
      ),
    ],
    h,
  );

// ── Empty state ───────────────────────────────────────────────────────────

const noSessionsView = (h: HtmlBuilder<Message>) =>
  emptyState(
    {
      icon: History,
      title: "No sessions yet",
      description: "Finished sessions appear here and can be exported as a spreadsheet.",
      action: h.a(
        [
          h.Class(buttonClass({ size: "lg" })),
          h.Href(hrefFor({ _tag: "StartTab" })),
          h.AriaLabel("Start a session"),
        ],
        ["Start a session"],
      ),
    },
    h,
  );

// ── Page ──────────────────────────────────────────────────────────────────

export const historyPage = (model: HistoryModel, h: HtmlBuilder<Message>) => {
  const groups = groupByDay(model.history);
  const openActions =
    model.historyActionsFor === null
      ? null
      : (model.history.find((session) => session.id === model.historyActionsFor) ?? null);

  return page(
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
      ...(model.history.length === 0
        ? [noSessionsView(h)]
        : groups.map((group) =>
            groupedList(
              { header: group.label },
              group.sessions.map((session) => sessionRow(session, h)),
              h,
            ),
          )),
      ...(openActions === null ? [] : [actionsSheet(openActions, h)]),
      ...(model.pendingHistoryDelete === null
        ? []
        : [
            confirmSheet(
              {
                id: "delete-session",
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
    h,
  );
};
