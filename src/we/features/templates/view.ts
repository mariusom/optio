import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import {
  ChevronRight,
  Ellipsis,
  LayoutTemplate,
  confirmSheet,
  emptyState,
  groupedList,
  hint,
  icon,
  notice,
  page,
  sheet,
  sheetAction,
  statusPill,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
      h.button(
        [
          h.Type("button"),
          h.Class(
            "flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left text-[1.0625rem] leading-snug transition-colors hover:bg-muted/60 active:bg-muted",
          ),
          h.OnClick(Message.ClickedTemplateRow({ id: template.id })),
          h.AriaLabel(`Open ${template.name}`),
        ],
        [
          h.span(
            [h.Class("flex min-w-0 flex-1 flex-col")],
            [
              h.span([h.Class("truncate")], [template.name]),
              h.span(
                [h.Class("truncate text-[0.9375rem] text-muted-foreground")],
                [questionSummaryLine(template.fieldCount, template.requiredCount)],
              ),
            ],
          ),
          ...(template.isDefault ? [statusPill({ tone: "primary" }, ["Default"], h)] : []),
          icon(h, ChevronRight, "size-5 shrink-0 text-muted-foreground/60"),
        ],
      ),
      h.button(
        [
          h.Type("button"),
          h.Class(
            "grid size-11 shrink-0 place-items-center self-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:opacity-60",
          ),
          h.OnClick(Message.OpenedTemplateActions({ id: template.id })),
          h.AriaLabel(`Actions for "${template.name}"`),
        ],
        [icon(h, Ellipsis, "size-5")],
      ),
    ],
  );

const addSamplesButton = (h: HtmlBuilder<Message>, className = "") =>
  h.button(
    [
      h.Type("button"),
      h.Class(
        cn("mx-auto min-h-11 px-4 text-[1.0625rem] text-primary active:opacity-60", className),
      ),
      h.OnClick(Message.ClickedAddSampleTemplates()),
      h.AriaLabel("Add sample templates"),
    ],
    ["Add sample templates"],
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
            className: "h-11 text-base font-semibold",
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
            className: "h-11 text-base",
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
            h.Class(cn(inputClass, "h-11 rounded-lg text-base")),
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
            className: "h-11 text-base",
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
                    className: "h-12 rounded-xl px-6 text-base font-semibold",
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
