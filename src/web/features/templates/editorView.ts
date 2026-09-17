import type { Html, HtmlBuilder } from "foldkit/html";

import {
  ArrowDown,
  ArrowUp,
  Plus,
  confirmSheet,
  controlRow,
  groupedList,
  hint,
  icon,
  navBar,
  navBarAction,
  notice,
  page,
  row,
  rowAction,
  statusPill,
} from "@/components/app";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { switch_ } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import type { FieldDef, FieldKind } from "../../../livestore/schema";
import { hrefFor } from "../../routes";
import { hasChanges, isTemplateValid } from "./editor";
import { answerTypeName, type Editor, type EditorModel } from "./editorTypes";
import { questionForm } from "./questionEditor";

export { answerTypeName } from "./editorTypes";
const backLink = { href: hrefFor({ _tag: "TemplatesTab" }), label: "Templates" };
/** Leaving with unsaved changes asks first (ClickedCancelEditTemplate checks for changes). */
const guardedBackLink = { ...backLink, onClick: Message.ClickedCancelEditTemplate() };

// ── Questions list ─────────────────────────────────────────────────────────

const moveButton = (
  config: Readonly<{ label: string; onClick: Message; isDisabled: boolean; up: boolean }>,
  h: HtmlBuilder<Message>,
): Html =>
  rowAction(
    {
      isDisabled: config.isDisabled,
      attributes: [h.AriaLabel(config.label)],
      onClick: config.onClick,
    },
    [icon(h, config.up ? ArrowUp : ArrowDown, "size-5")],
    h,
  );

const questionRow = (
  options: Readonly<{ field: FieldDef; index: number; total: number; isDisabled: boolean }>,
  h: HtmlBuilder<Message>,
) => {
  const { field, index, total, isDisabled } = options;
  return h.keyed("div")(
    field.id,
    [h.Class("lazy-row flex w-full items-stretch")],
    [
      row(
        {
          title: field.name === "" ? "Untitled question" : field.name,
          subtitle: answerTypeName(field.kind as FieldKind),
          trailing: field.isRequired ? statusPill({ tone: "primary" }, ["Required"], h) : undefined,
          className: "min-w-0 flex-1",
          onClick: Message.ClickedEditField({ id: field.id }),
          isDisabled,
          attributes: [h.AriaLabel(`Edit question ${field.name}`)],
        },
        h,
      ),
      h.div(
        [h.Class("flex shrink-0 items-stretch")],
        [
          moveButton(
            {
              label: `Move ${field.name} up`,
              up: true,
              isDisabled: isDisabled || index === 0,
              onClick: Message.ClickedMoveFieldUp({ id: field.id }),
            },
            h,
          ),
          moveButton(
            {
              label: `Move ${field.name} down`,
              up: false,
              isDisabled: isDisabled || index === total - 1,
              onClick: Message.ClickedMoveFieldDown({ id: field.id }),
            },
            h,
          ),
        ],
      ),
    ],
  );
};

// ── Template details ───────────────────────────────────────────────────────

const nameRow = (editor: Editor, h: HtmlBuilder<Message>) =>
  controlRow(
    [
      h.label([h.For("template-name"), h.Class(cn(inputLabelClass))], ["Name"]),
      h.input([
        h.Id("template-name"),
        h.Type("text"),
        h.Class(cn(inputClass)),
        h.Value(editor.name),
        h.Placeholder("Morning observations"),
        h.Autocomplete("off"),
        h.Autocapitalize("sentences"),
        h.EnterKeyHint("done"),
        h.OnInput((value) => Message.ChangedEditorName({ text: value })),
      ]),
    ],
    h,
    inlineFieldClass,
  );

const defaultRow = (editor: Editor, h: HtmlBuilder<Message>) =>
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

const loadingView = (lastError: string | null, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("template-editor flex min-h-full flex-col")],
    [
      navBar({ title: "Template", back: backLink }, h),
      page(
        { className: "pt-6" },
        [
          ...(lastError === null ? [] : [notice({ tone: "error", text: lastError }, h)]),
          hint("Opening the template…", h),
        ],
        h,
      ),
    ],
  );

const editorNavBar = (
  options: Readonly<{ editor: Editor; showCreate?: boolean; canSave: boolean }>,
  h: HtmlBuilder<Message>,
) => {
  const { editor, showCreate, canSave } = options;
  return navBar(
    {
      title:
        editor.draft !== null
          ? editor.editingFieldId === null
            ? "New question"
            : "Edit question"
          : showCreate
            ? "New template"
            : "Template builder",
      subtitle: editor.draft !== null ? editor.name || "Untitled template" : undefined,
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

const questionsList = (editor: Editor, h: HtmlBuilder<Message>) =>
  groupedList(
    {
      header: "2. Questions",
      footer:
        editor.fields.length === 0
          ? "Add a question for each thing you note down, such as activity, location or notes."
          : `${editor.fields.length} question${editor.fields.length === 1 ? "" : "s"}`,
    },
    [
      ...editor.fields.map((field, index) =>
        h.keyed("div")(
          field.id,
          [],
          [
            questionRow(
              {
                field,
                index,
                total: editor.fields.length,
                isDisabled: editor.draft !== null || editor.isSaving,
              },
              h,
            ),
          ],
        ),
      ),
      row(
        {
          title: "Add question",
          leading: icon(h, Plus, "size-5 text-primary"),
          onClick: Message.ClickedAddField(),
          isDisabled: editor.draft !== null || editor.isSaving,
          attributes: [h.AriaLabel("Add question")],
        },
        h,
      ),
    ],
    h,
  );

const overview = (editor: Editor, saveHint: string | null, h: HtmlBuilder<Message>) => [
  h.div(
    [h.Class("grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start")],
    [
      groupedList(
        {
          header: "1. Template details",
          footer: "Name your template, then build the questions in the order you’ll answer them.",
        },
        [nameRow(editor, h), defaultRow(editor, h)],
        h,
      ),
      h.div([h.Class("flex min-w-0 flex-col gap-4")], [questionsList(editor, h)]),
    ],
  ),
  ...(saveHint === null ? [] : [hint(saveHint, h)]),
];

const discardConfirmation = (editor: Editor, h: HtmlBuilder<Message>) =>
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
            cancelAriaLabel: "Continue editing",
            dismissLabel: "Continue editing",
            destructive: true,
            onConfirm: Message.ConfirmedDiscard(),
            onCancel: Message.CanceledDiscard(),
          },
          h,
        ),
      ]
    : [];

export const templateEditorPage = (model: EditorModel, h: HtmlBuilder<Message>) => {
  if (model.editor === null) return loadingView(model.lastError, h);

  const editor = model.editor;
  const isValid = isTemplateValid(editor);
  const changed = hasChanges(editor as unknown as Parameters<typeof hasChanges>[0]);
  const canSave = isValid && changed && !editor.isSaving && editor.draft === null;
  const saveHint = !isValid ? "Give the template a name to save it." : null;

  return h.div(
    [h.Class("template-editor flex min-h-full flex-col")],
    [
      editorNavBar({ editor, showCreate: model.showCreate, canSave }, h),
      page(
        { className: "pt-6", wide: true },
        [
          ...(model.lastError === null
            ? []
            : [notice({ tone: "error", text: model.lastError }, h)]),
          ...(editor.draft !== null ? [questionForm(editor, h)] : overview(editor, saveHint, h)),
        ],
        h,
      ),
      ...discardConfirmation(editor, h),
    ],
  );
};
