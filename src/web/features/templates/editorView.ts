import { Array } from "effect";
import type { H } from "@/lib/view";

import {
  Plus,
  controlRow,
  groupedList,
  hint,
  icon,
  navBar,
  navBarAction,
  notice,
  page,
  row,
  statusPill,
} from "@/components/app";
import { confirmSheet } from "../../sheets";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { switch_ } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import type { FieldDef } from "../../../domain/fields";
import { hrefFor } from "../../routes";
import { hasChanges, isTemplateValid } from "./editor";
import { answerTypeName, type Editor, type EditorModel } from "./editorTypes";
import { questionForm } from "./questionEditor";
import { reorderButtons } from "./reorderButtons";

const backLink = { href: hrefFor({ _tag: "TemplatesTab" }), label: "Templates" };
/** Leaving with unsaved changes asks first (ClickedCancelEditTemplate checks for changes). */
const guardedBackLink = { ...backLink, onClick: Message.ClickedCancelEditTemplate() };

// ── Questions list ─────────────────────────────────────────────────────────

const questionRow = (
  options: Readonly<{ field: FieldDef; index: number; total: number; isDisabled: boolean }>,
  h: H<Message>,
) => {
  const { field, index, total, isDisabled } = options;
  return h.div
    .key(field.id)
    .class("lazy-row flex w-full items-stretch")
    .children(
      row(
        {
          title: field.name === "" ? "Untitled question" : field.name,
          subtitle: answerTypeName(field.kind),
          trailing: field.isRequired ? statusPill({ tone: "primary" }, ["Required"], h) : undefined,
          className: "min-w-0 flex-1",
          onClick: Message.ClickedEditField({ id: field.id }),
          isDisabled,
          // Named by its visible text (name, answer type, Required) for voice control.
        },
        h,
      ),
      reorderButtons(
        {
          subject: field.name,
          index,
          total,
          isDisabled,
          up: Message.ClickedMoveFieldUp({ id: field.id }),
          down: Message.ClickedMoveFieldDown({ id: field.id }),
        },
        h,
      ),
    );
};

// ── Template details ───────────────────────────────────────────────────────

const nameRow = (editor: Editor, h: H<Message>) =>
  controlRow(
    [
      h.label.attr("for", "template-name").class(cn(inputLabelClass)).children("Name"),
      h.input
        .id("template-name")
        .attr("type", "text")
        .class(cn(inputClass))
        .value(editor.name)
        .attr("placeholder", "Morning observations")
        .attr("autocomplete", "off")
        .attr("autocapitalize", "sentences")
        .attr("enterkeyhint", "done")
        .on("input", ({ value }) => Message.ChangedEditorName({ text: value })),
    ],
    h,
    inlineFieldClass,
  );

const defaultRow = (editor: Editor, h: H<Message>) =>
  controlRow(
    [
      switch_(
        {
          id: "template-default",
          isChecked: editor.isDefault,
          onToggle: () => Message.ToggledEditorDefault(),
          label: "Use as default",
          description: "Chosen first when you start a session.",
          wrapperClass: "flex-row-reverse justify-between gap-4",
        },
        h,
      ),
    ],
    h,
  );

const loadingView = (lastError: string | null, loadFailed: boolean, h: H<Message>) =>
  h.div.class("template-editor flex min-h-full flex-col").children(
    navBar({ title: "Template", back: backLink }, h),
    page(
      {},
      [
        ...(lastError === null ? [] : [notice({ tone: "error", text: lastError }, h)]),
        loadFailed
          ? notice(
              {
                tone: "error",
                text: "This template couldn’t be opened. Go back to Templates and try again.",
              },
              h,
            )
          : hint("Opening the template…", h),
      ],
      h,
    ),
  );

const editorNavBar = (
  options: Readonly<{ editor: Editor; showCreate?: boolean; canSave: boolean }>,
  h: H<Message>,
) => {
  const { editor, showCreate, canSave } = options;
  return navBar(
    {
      title:
        editor.draft !== null
          ? editor.editingFieldId === null
            ? "New question"
            : "Edit question"
          : showCreate === true
            ? "New template"
            : "Template builder",
      subtitle:
        editor.draft !== null
          ? editor.name !== ""
            ? editor.name
            : "Untitled template"
          : undefined,
      wide: true,
      back:
        editor.draft !== null
          ? { ...backLink, label: "Template builder", onClick: Message.ClickedBackFromField() }
          : guardedBackLink,
      trailing:
        editor.draft !== null
          ? []
          : [
              navBarAction(
                {
                  label: editor.isSaving ? "Saving…" : "Save",
                  emphasized: true,
                  isDisabled: !canSave,
                  onClick: Message.ClickedSaveTemplate(),
                  ariaLabel: "Save template",
                },
                h,
              ),
            ],
    },
    h,
  );
};

const questionsList = (editor: Editor, h: H<Message>) =>
  groupedList(
    {
      header: "2. Questions",
      footer:
        editor.fields.length === 0
          ? "Add a question for each thing you note down, such as activity, location or notes."
          : `${editor.fields.length} question${editor.fields.length === 1 ? "" : "s"}`,
    },
    [
      ...Array.map(editor.fields, (field, index) =>
        h.div.key(field.id).children(
          questionRow(
            {
              field,
              index,
              total: editor.fields.length,
              isDisabled: editor.draft !== null || editor.isSaving,
            },
            h,
          ),
        ),
      ),
      row(
        {
          title: "Add question",
          leading: icon(h, Plus, "size-5 text-primary"),
          onClick: Message.ClickedAddField(),
          isDisabled: editor.draft !== null || editor.isSaving,
          attrs: { "aria-label": "Add question" },
        },
        h,
      ),
    ],
    h,
  );

const overview = (editor: Editor, saveHint: string | null, h: H<Message>) => [
  h.div
    .class("grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start")
    .children(
      groupedList(
        {
          header: "1. Template details",
          footer: "Name your template, then build the questions in the order you’ll answer them.",
        },
        [nameRow(editor, h), defaultRow(editor, h)],
        h,
      ),
      h.div.class("flex min-w-0 flex-col gap-4").children(questionsList(editor, h)),
    ),
  ...(saveHint === null ? [] : [hint(saveHint, h)]),
];

const discardConfirmation = (editor: Editor, h: H<Message>) =>
  editor.pendingDiscard
    ? [
        confirmSheet(
          {
            id: "discard-template-changes",
            title: "Discard your changes?",
            message: "What you changed here will be lost.",
            confirmLabel: "Discard",
            cancelLabel: "Keep editing",
            confirmAriaLabel: "Confirm discard changes",
            cancelAriaLabel: "Keep editing",
            destructive: true,
            onConfirm: Message.ConfirmedDiscard(),
            onCancel: Message.CanceledDiscard(),
          },
          h,
        ),
      ]
    : [];

export const templateEditorPage = (model: EditorModel, h: H<Message>) => {
  if (model.editor === null)
    return loadingView(model.lastError, model.detailLoadFailed ?? false, h);

  const editor = model.editor;
  const isValid = isTemplateValid(editor);
  const changed = hasChanges(editor);
  const canSave = isValid && changed && !editor.isSaving && editor.draft === null;
  const saveHint = !isValid ? "Give the template a name to save it." : null;

  return h.div
    .class("template-editor flex min-h-full flex-col")
    .children(
      editorNavBar({ editor, showCreate: model.showCreate, canSave }, h),
      page(
        { wide: true },
        [
          ...(model.lastError === null
            ? []
            : [notice({ tone: "error", text: model.lastError }, h)]),
          ...(editor.draft !== null ? [questionForm(editor, h)] : overview(editor, saveHint, h)),
        ],
        h,
      ),
      discardConfirmation(editor, h),
    );
};
