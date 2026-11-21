import { Array, Option, Order } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  Download,
  History,
  Trash2,
  dataGrid,
  emptyState,
  icon,
  notice,
  page,
  type GridState,
} from "@/components/app";
import { confirmSheet, sheet, sheetAction } from "../../sheets";
import { buttonClass } from "@/components/ui/button";
import { Message } from "../../../messages";
import { formatDurationShort, formatTimeOnly } from "../../format";
import { hrefFor } from "../../routes";
import { dayGroupLabel, taskCountLabel } from "./helpers";

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
  readonly historyGrid: GridState;
};

// ── Table ─────────────────────────────────────────────────────────────────

/** "<template> · 4 tasks"; the template name is isolated so right-to-left names keep the order. */
const summaryFor = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  h.span([], [h.bdi([], [session.templateName]), ` · ${taskCountLabel(session.taskCount)}`]);

const durationOf = (session: HistorySession): number => session.endedAt - session.startedAt;

/** Phones hide the template, duration and task columns; the name cell repeats them. */
const nameCell = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  h.span(
    [h.Class("flex min-w-0 flex-col")],
    [
      h.span([h.Class("truncate")], [session.displayName]),
      h.span(
        [h.Class("truncate text-xs font-normal text-muted-foreground md:hidden")],
        [
          summaryFor(session, h),
          h.span([h.Class("sm:hidden")], [` · ${formatDurationShort(durationOf(session))}`]),
        ],
      ),
    ],
  );

const historyGrid = (model: HistoryModel, h: HtmlBuilder<Message>): Html =>
  dataGrid(
    {
      id: "history",
      label: "Sessions",
      noun: "sessions",
      singular: "session",
      rows: model.history,
      rowId: (session) => session.id,
      onOpen: (session) => Message.ClickedHistoryRow({ id: session.id }),
      actions: {
        label: (session) => `Actions for "${session.displayName}"`,
        onClick: (session) => Message.OpenedHistoryActions({ id: session.id }),
      },
      columns: [
        {
          id: "name",
          header: "Session",
          value: (session) => session.displayName,
          cell: (session) => nameCell(session, h),
          searchable: true,
        },
        {
          id: "template",
          header: "Template",
          value: (session) => session.templateName,
          cell: (session) => h.bdi([], [session.templateName]),
          from: "md",
          searchable: true,
        },
        {
          id: "started",
          header: "Started",
          value: (session) => session.startedAt,
          cell: (session) =>
            `${dayGroupLabel(session.startedAt, model.now)}, ${formatTimeOnly(session.startedAt)}`,
          descFirst: true,
          className: "whitespace-nowrap",
        },
        {
          id: "duration",
          header: "Duration",
          value: durationOf,
          cell: (session) => formatDurationShort(durationOf(session)),
          align: "end",
          from: "sm",
          descFirst: true,
        },
        {
          id: "tasks",
          header: "Tasks",
          value: (session) => session.taskCount,
          cell: (session) => globalThis.String(session.taskCount),
          align: "end",
          from: "md",
          descFirst: true,
        },
      ],
      filters: [
        {
          columnId: "template",
          label: "Template",
          allLabel: "All templates",
          options: Array.sort(
            Array.dedupe(Array.map(model.history, (session) => session.templateName)),
            Order.String,
          ),
        },
      ],
      state: model.historyGrid,
      onChange: (state) => Message.ChangedGrid({ grid: "history", state }),
    },
    h,
  );

// ── Action sheet: Export / Delete ─────────────────────────────────────────

const historyActionsSheet = (session: HistorySession, h: HtmlBuilder<Message>): Html =>
  sheet(
    {
      id: "history-actions",
      title: session.displayName,
      description: summaryFor(session, h),
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
  const openActions =
    model.historyActionsFor === null
      ? null
      : Option.getOrNull(
          Array.findFirst(model.history, (session) => session.id === model.historyActionsFor),
        );

  return page(
    { wide: true },
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
      ...(model.history.length === 0 ? [noSessionsView(h)] : [historyGrid(model, h)]),
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
