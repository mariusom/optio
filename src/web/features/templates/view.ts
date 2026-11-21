import { Array, Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import {
  ChartBar,
  Copy,
  LayoutTemplate,
  Play,
  Star,
  Trash2,
  dataGrid,
  emptyState,
  icon,
  notice,
  page,
  statusPill,
  type GridState,
} from "@/components/app";
import { confirmSheet, sheet, sheetAction } from "../../sheets";
import { button } from "@/components/ui/button";
import { Message } from "../../../messages";
import { questionSummaryLine } from "./naming";
import type { TemplateReport, TemplateSummary } from "../../types";
import { templateReportSheet } from "./reportSheet";
import { displaySessionName, type ActiveSession } from "../session/startHelpers";

// Templates tab — a searchable, sortable table of templates. Opening a row
// shows the editor; the "⋯" button opens an action sheet (start session / set
// as default / time report / duplicate / delete).

type TemplatesModel = {
  readonly templates: ReadonlyArray<TemplateSummary>;
  readonly showCreate: boolean;
  readonly newName: string;
  readonly pendingDelete: { readonly id: string; readonly name: string } | null;
  readonly templateActionsFor?: string | null;
  readonly templateReportFor?: string | null;
  readonly templateReport?: TemplateReport | null;
  /** The report could not be read, or the store is unavailable. */
  readonly templateReportFailed?: boolean;
  readonly lastError: string | null;
  /** The live session, if any: only one can run, so the sheet offers to resume it. */
  readonly liveSession?: ActiveSession | null;
  readonly templatesGrid: GridState;
};

// ── Table ──────────────────────────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Phones hide the count columns; the name cell repeats them under the name. */
const nameCell = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  h.span(
    [h.Class("flex min-w-0 flex-col items-start gap-0.5")],
    [
      h.span(
        [h.Class("flex max-w-full min-w-0 items-center gap-2")],
        [
          h.span([h.Class("truncate")], [template.name]),
          ...(template.isDefault ? [statusPill({ tone: "primary" }, ["Default"], h)] : []),
        ],
      ),
      h.span(
        [h.Class("truncate text-xs font-normal text-muted-foreground sm:hidden")],
        [questionSummaryLine(template.fieldCount, template.requiredCount)],
      ),
    ],
  );

const templatesGrid = (model: TemplatesModel, h: HtmlBuilder<Message>) =>
  dataGrid(
    {
      id: "templates",
      label: "Templates",
      noun: "templates",
      singular: "template",
      rows: model.templates,
      rowId: (template) => template.id,
      onOpen: (template) => Message.ClickedTemplateRow({ id: template.id }),
      actions: {
        label: (template) => `Actions for "${template.name}"`,
        onClick: (template) => Message.OpenedTemplateActions({ id: template.id }),
      },
      columns: [
        {
          id: "name",
          header: "Name",
          value: (template) => template.name,
          cell: (template) => nameCell(template, h),
          searchable: true,
        },
        {
          id: "questions",
          header: "Questions",
          value: (template) => template.fieldCount,
          cell: (template) => String(template.fieldCount),
          align: "end",
          from: "sm",
          descFirst: true,
        },
        {
          id: "required",
          header: "Required",
          value: (template) => template.requiredCount,
          cell: (template) => String(template.requiredCount),
          align: "end",
          from: "sm",
          descFirst: true,
        },
        {
          id: "updated",
          header: "Updated",
          value: (template) => template.updatedAt,
          cell: (template) => dateFormatter.format(template.updatedAt),
          from: "md",
          descFirst: true,
          className: "whitespace-nowrap",
        },
      ],
      state: model.templatesGrid,
      onChange: (state) => Message.ChangedGrid({ grid: "templates", state }),
    },
    h,
  );

const addSamplesButton = (h: HtmlBuilder<Message>) =>
  button(
    {
      variant: "link",
      className: "mx-auto",
      onClick: Message.ClickedAddSampleTemplates(),
      attributes: [h.AriaLabel("Add sample templates")],
    },
    "Add sample templates",
    h,
  );

// ── Sheets ─────────────────────────────────────────────────────────────────

/** Starts a session with this template, or resumes the one already running. */
const startAction = (
  template: TemplateSummary,
  liveSession: ActiveSession | null,
  h: HtmlBuilder<Message>,
) =>
  liveSession === null
    ? [
        sheetAction(
          {
            label: "Start session",
            leading: icon(h, Play),
            onClick: Message.ClickedStartTemplateSession({ id: template.id }),
          },
          h,
        ),
      ]
    : [
        sheetAction(
          {
            label: "Resume live session",
            leading: icon(h, Play),
            onClick: Message.ClickedStartTemplateSession({ id: template.id }),
          },
          h,
        ),
        h.p(
          [h.Class("-mt-1 pb-1 pl-7 text-xs text-muted-foreground")],
          [
            `“${displaySessionName(liveSession.sessionName, liveSession.templateName)}” is still recording. End it to start another session.`,
          ],
        ),
      ];

const actionsSheet = (
  template: TemplateSummary,
  liveSession: ActiveSession | null,
  h: HtmlBuilder<Message>,
) =>
  sheet(
    {
      id: "template-actions",
      title: template.name,
      description: questionSummaryLine(template.fieldCount, template.requiredCount),
      onDismiss: Message.ClosedTemplateActions(),
      footer: {
        cancel: { label: "Cancel", onClick: Message.ClosedTemplateActions() },
      },
    },
    [
      h.div(
        [h.Class("flex flex-col gap-1")],
        [
          ...startAction(template, liveSession, h),
          ...(template.isDefault
            ? []
            : [
                sheetAction(
                  {
                    label: "Set as default",
                    leading: icon(h, Star),
                    onClick: Message.ClickedSetDefaultTemplate({ id: template.id }),
                  },
                  h,
                ),
              ]),
          sheetAction(
            {
              label: "Time report",
              leading: icon(h, ChartBar),
              onClick: Message.OpenedTemplateReport({ id: template.id }),
            },
            h,
          ),
          sheetAction(
            {
              label: "Duplicate",
              leading: icon(h, Copy),
              onClick: Message.ClickedDuplicateTemplate({ id: template.id }),
            },
            h,
          ),
          sheetAction(
            {
              label: "Delete",
              leading: icon(h, Trash2),
              destructive: true,
              onClick: Message.RequestedDeleteTemplate({ id: template.id, name: template.name }),
            },
            h,
          ),
        ],
      ),
    ],
    h,
  );

const deleteSheet = (
  pending: { readonly id: string; readonly name: string },
  h: HtmlBuilder<Message>,
) =>
  confirmSheet(
    {
      id: "delete-template",
      title: `Delete “${pending.name}”?`,
      message: "Sessions you already recorded with it are kept.",
      confirmLabel: "Delete",
      confirmAriaLabel: "Confirm delete",
      cancelAriaLabel: "Cancel delete",
      destructive: true,
      onConfirm: Message.ConfirmedDeleteTemplate(),
      onCancel: Message.CanceledDeleteTemplate(),
    },
    h,
  );

// ── Public entry ───────────────────────────────────────────────────────────

export const templatesPage = (model: TemplatesModel, h: HtmlBuilder<Message>) => {
  const openFor =
    model.templateActionsFor === undefined || model.templateActionsFor === null
      ? null
      : Option.getOrNull(
          Array.findFirst(model.templates, (t) => t.id === model.templateActionsFor),
        );
  const reportFor =
    model.templateReportFor === undefined || model.templateReportFor === null
      ? null
      : Option.getOrNull(Array.findFirst(model.templates, (t) => t.id === model.templateReportFor));

  const body =
    model.templates.length === 0
      ? emptyState(
          {
            icon: LayoutTemplate,
            title: "No templates yet",
            description: "A template is the short list of questions you answer for each task.",
            action: h.div(
              [h.Class("flex flex-col items-center gap-1")],
              [
                button(
                  {
                    size: "lg",
                    onClick: Message.ClickedNewTemplate(),
                    attributes: [h.AriaLabel("Create template")],
                  },
                  "Create template",
                  h,
                ),
                addSamplesButton(h),
              ],
            ),
          },
          h,
        )
      : h.div([h.Class("flex flex-col gap-3")], [templatesGrid(model, h), addSamplesButton(h)]);

  return page(
    { wide: true },
    [
      ...(model.lastError === null ? [] : [notice({ tone: "error", text: model.lastError }, h)]),
      body,
      ...(openFor === null ? [] : [actionsSheet(openFor, model.liveSession ?? null, h)]),
      ...(reportFor === null
        ? []
        : [
            templateReportSheet(
              reportFor,
              model.templateReportFailed === true ? "failed" : (model.templateReport ?? null),
              h,
            ),
          ]),
      ...(model.pendingDelete === null ? [] : [deleteSheet(model.pendingDelete, h)]),
    ],
    h,
  );
};
