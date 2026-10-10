import type { HtmlBuilder } from "foldkit/html";

import {
  ChartBar,
  Copy,
  Ellipsis,
  LayoutTemplate,
  Play,
  Star,
  Trash2,
  emptyState,
  groupedList,
  icon,
  notice,
  page,
  row,
  rowAction,
  statusPill,
} from "@/components/app";
import { confirmSheet, sheet, sheetAction } from "../../sheets";
import { button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { questionSummaryLine } from "./naming";
import type { TemplateReport, TemplateSummary } from "../../types";
import { templateReportSheet } from "./reportSheet";
import { displaySessionName, type ActiveSession } from "../session/startHelpers";

// Templates tab — a grouped list of templates (a two-column card grid from
// 1280px). Tapping a row opens the editor; the "⋯" button opens an action sheet
// (start session / set as default / duplicate / delete).

type TemplatesModel = {
  readonly templates: ReadonlyArray<TemplateSummary>;
  readonly showCreate: boolean;
  readonly newName: string;
  readonly pendingDelete: { readonly id: string; readonly name: string } | null;
  readonly templateActionsFor?: string | null;
  readonly templateReportFor?: string | null;
  readonly templateReport?: TemplateReport | null;
  readonly lastError: string | null;
  /** The live session, if any: only one can run, so the sheet offers to resume it. */
  readonly liveSession?: ActiveSession | null;
};

// ── Rows ───────────────────────────────────────────────────────────────────

// From 1280px the grouped card becomes a two-column grid of row cards; DOM
// (and keyboard) order stays row-major, matching the visual order.
const gridListClass =
  "xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:overflow-visible xl:rounded-none xl:bg-transparent xl:ring-0";
const gridCardClass = "xl:overflow-hidden xl:rounded-xl xl:bg-card xl:ring-1 xl:ring-foreground/10";

const templateRow = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    template.id,
    [h.Class(cn("lazy-row flex w-full items-stretch", gridCardClass))],
    [
      row(
        {
          title: template.name,
          subtitle: questionSummaryLine(template.fieldCount, template.requiredCount),
          trailing: template.isDefault
            ? statusPill({ tone: "primary" }, ["Default"], h)
            : undefined,
          className: "min-w-0 flex-1",
          // Named by its visible text (title, counts, badge) so voice control matches it.
          onClick: Message.ClickedTemplateRow({ id: template.id }),
        },
        h,
      ),
      rowAction(
        {
          onClick: Message.OpenedTemplateActions({ id: template.id }),
          attributes: [h.AriaLabel(`Actions for "${template.name}"`)],
        },
        [icon(h, Ellipsis, "size-5")],
        h,
      ),
    ],
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
      : (model.templates.find((t) => t.id === model.templateActionsFor) ?? null);
  const reportFor =
    model.templateReportFor === undefined || model.templateReportFor === null
      ? null
      : (model.templates.find((t) => t.id === model.templateReportFor) ?? null);

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
      : h.div(
          [h.Class("flex flex-col gap-3")],
          [
            groupedList(
              { header: "Your templates", className: gridListClass },
              model.templates.map((template) => templateRow(template, h)),
              h,
            ),
            addSamplesButton(h),
          ],
        );

  return page(
    {},
    [
      ...(model.lastError === null ? [] : [notice({ tone: "error", text: model.lastError }, h)]),
      body,
      ...(openFor === null ? [] : [actionsSheet(openFor, model.liveSession ?? null, h)]),
      ...(reportFor === null
        ? []
        : [templateReportSheet(reportFor, model.templateReport ?? null, h)]),
      ...(model.pendingDelete === null ? [] : [deleteSheet(model.pendingDelete, h)]),
    ],
    h,
  );
};
