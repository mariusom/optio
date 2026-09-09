import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import {
  Ellipsis,
  LayoutTemplate,
  confirmSheet,
  emptyState,
  groupedList,
  hint,
  icon,
  notice,
  page,
  row,
  sheet,
  sheetAction,
  statusPill,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { Message } from "../../../messages";
import { questionSummaryLine } from "./naming";
import type { TemplateSummary } from "../../../we/types";

// Templates tab — a grouped list of templates. Tapping a row opens the editor;
// the "⋯" button opens an action sheet (set as default / duplicate / delete).

type TemplatesModel = {
  readonly templates: ReadonlyArray<TemplateSummary>;
  readonly showCreate: boolean;
  readonly newName: string;
  readonly pendingDelete: { readonly id: string; readonly name: string } | null;
  readonly templateActionsFor?: string | null;
  readonly lastError: string | null;
};

// ── Rows ───────────────────────────────────────────────────────────────────

const templateRow = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    template.id,
    [h.Class("lazy-row flex w-full items-stretch")],
    [
      row(
        {
          title: template.name,
          subtitle: questionSummaryLine(template.fieldCount, template.requiredCount),
          trailing: template.isDefault
            ? statusPill({ tone: "primary" }, ["Default"], h)
            : undefined,
          chevron: true,
          className: "min-w-0 flex-1",
          onClick: Message.ClickedTemplateRow({ id: template.id }),
          attributes: [h.AriaLabel(`Open ${template.name}`)],
        },
        h,
      ),
      button(
        {
          variant: "ghost",
          size: "icon",
          className: "self-center",
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

const createSheet = (newName: string, h: HtmlBuilder<Message>) => {
  const canCreate = newName.trim() !== "";
  return sheet(
    {
      id: "new-template",
      title: "New template",
      onDismiss: Message.CanceledCreateTemplate(),
      dismissLabel: "Cancel creating template",
      footer: [
        button(
          {
            size: "lg",
            isDisabled: !canCreate,
            onClick: Message.ConfirmedCreateTemplate(),
            attributes: [h.AriaLabel("Create template")],
          },
          "Create",
          h,
        ),
        button(
          {
            variant: "secondary",
            size: "lg",
            onClick: Message.CanceledCreateTemplate(),
            attributes: [h.AriaLabel("Cancel")],
          },
          "Cancel",
          h,
        ),
      ],
    },
    [
      h.div(
        [h.Class("flex flex-col gap-2 pb-1")],
        [
          h.label([h.For("new-template-name"), h.Class("sr-only")], ["Template name"]),
          h.input([
            h.Id("new-template-name"),
            h.Type("text"),
            h.Class(inputClass),
            h.Value(newName),
            h.Placeholder("Morning observations"),
            h.AriaLabel("Template name"),
            h.Autocomplete("off"),
            h.Autocapitalize("sentences"),
            h.EnterKeyHint("done"),
            h.Autofocus(true),
            h.OnInput((value) => Message.ChangedNewName({ text: value })),
            h.OnKeyDownPreventDefault((key) =>
              key === "Enter" && canCreate
                ? Option.some(Message.ConfirmedCreateTemplate())
                : Option.none(),
            ),
          ]),
          ...(canCreate ? [] : [hint("Give the template a name to continue.", h)]),
        ],
      ),
    ],
    h,
  );
};

const actionsSheet = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  sheet(
    {
      id: "template-actions",
      title: template.name,
      description: questionSummaryLine(template.fieldCount, template.requiredCount),
      onDismiss: Message.ClosedTemplateActions(),
      dismissLabel: `Close actions for "${template.name}"`,
      footer: [
        button(
          {
            variant: "secondary",
            size: "lg",
            onClick: Message.ClosedTemplateActions(),
            attributes: [h.AriaLabel("Cancel")],
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
          ...(template.isDefault
            ? []
            : [
                sheetAction(
                  {
                    label: "Set as default",
                    onClick: Message.ClickedSetDefaultTemplate({ id: template.id }),
                  },
                  h,
                ),
              ]),
          sheetAction(
            {
              label: "Duplicate",
              onClick: Message.ClickedDuplicateTemplate({ id: template.id }),
            },
            h,
          ),
          sheetAction(
            {
              label: "Delete",
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
      dismissLabel: "Cancel deleting template",
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
              { header: "Your templates" },
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
      ...(model.showCreate ? [createSheet(model.newName, h)] : []),
      ...(openFor === null ? [] : [actionsSheet(openFor, h)]),
      ...(model.pendingDelete === null ? [] : [deleteSheet(model.pendingDelete, h)]),
    ],
    h,
  );
};
