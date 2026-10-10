import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Download,
  Ellipsis,
  History,
  Trash2,
  emptyState,
  groupedList,
  icon,
  notice,
  page,
  row,
  rowAction,
} from "@/components/app";
import { confirmSheet, sheet, sheetAction } from "../../sheets";
import { buttonClass } from "@/components/ui/button";
import { Message } from "../../../messages";
import { formatDurationShort, formatTimeOnly } from "../../format";
import { hrefFor } from "../../routes";
import { daySummaryLabel, groupByDay, taskCountLabel } from "./helpers";

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
  /** Ticked Model time; day labels ("Today") are relative to it. */
  readonly now: number;
  readonly pendingHistoryDelete: { readonly id: string; readonly displayName: string } | null;
  readonly historyActionsFor: string | null;
  readonly historyError: string | null;
};

// ── One session ───────────────────────────────────────────────────────────

const summaryFor = (session: HistorySession): string =>
  [session.templateName, taskCountLabel(session.taskCount)].join(" · ");

/** Start time over duration, right-aligned, so neither is cut off on phones. */
const timesFor = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  h.span(
    [h.Class("flex flex-col items-end text-sm leading-tight")],
    [
      h.span([], [formatTimeOnly(session.startedAt)]),
      h.span(
        [h.Class("text-xs text-muted-foreground tabular")],
        [formatDurationShort(session.endedAt - session.startedAt)],
      ),
    ],
  );

/**
 * A tappable row plus its own "⋯" button. The two controls sit side by side
 * inside one list cell — a button can't be nested inside the row's button.
 */
const sessionRow = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  h.keyed("div")(
    session.id,
    [h.Class("flex items-stretch")],
    [
      row(
        {
          title: session.displayName,
          subtitle: summaryFor(session),
          value: timesFor(session, h),
          onClick: Message.ClickedHistoryRow({ id: session.id }),
          chevron: true,
          lazy: true,
          className: "min-w-0 flex-1",
          // Named by its visible text, so voice control matches it.
        },
        h,
      ),
      rowAction(
        {
          attributes: [h.AriaLabel(`Actions for "${session.displayName}"`)],
          onClick: Message.OpenedHistoryActions({ id: session.id }),
        },
        [icon(h, Ellipsis, "size-5")],
        h,
      ),
    ],
  );

/** "Today · 3 sessions · 1h 12m", with the totals quieter than the day. */
const dayHeader = (
  group: { readonly label: string; readonly sessions: ReadonlyArray<HistorySession> },
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [],
    [
      group.label,
      h.span(
        [h.Class("font-normal text-muted-foreground")],
        [` · ${daySummaryLabel(group.sessions)}`],
      ),
    ],
  );

// ── Action sheet: Export / Delete ─────────────────────────────────────────

const historyActionsSheet = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  sheet(
    {
      id: "history-actions",
      title: session.displayName,
      description: summaryFor(session),
      onDismiss: Message.ClosedHistoryActions(),
      footer: {
        cancel: {
          label: "Cancel",
          onClick: Message.ClosedHistoryActions(),
          ariaLabel: "Cancel actions",
        },
      },
    },
    [
      h.div(
        [h.Class("flex flex-col gap-1")],
        [
          sheetAction(
            {
              label: "Export CSV",
              leading: icon(h, Download, "size-5"),
              isDisabled: session.taskCount === 0,
              onClick: Message.ClickedExportHistoryCsv({
                sessionId: session.id,
                spreadsheetSafe: true,
              }),
              // Named by its visible label, "Export CSV"; the sheet title names the session.
            },
            h,
          ),
          sheetAction(
            {
              label: "Delete",
              leading: icon(h, Trash2, "size-5"),
              destructive: true,
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
  const groups = groupByDay(model.history, model.now);
  const openActions =
    model.historyActionsFor === null
      ? null
      : (model.history.find((session) => session.id === model.historyActionsFor) ?? null);

  return page(
    {},
    [
      ...(model.historyError === null
        ? []
        : [
            notice(
              {
                tone: "error",
                text: model.historyError,
                onDismiss: Message.DismissedHistoryError(),
                dismissLabel: "Dismiss error",
              },
              h,
            ),
          ]),
      ...(model.history.length === 0
        ? [noSessionsView(h)]
        : groups.map((group) =>
            groupedList(
              { header: dayHeader(group, h) },
              group.sessions.map((session) => sessionRow(session, h)),
              h,
            ),
          )),
      ...(openActions === null ? [] : [historyActionsSheet(openActions, h)]),
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
