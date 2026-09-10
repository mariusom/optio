import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  ArrowDown,
  ArrowUp,
  Plus,
  X,
  actionGroup,
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
import { button } from "@/components/ui/button";
import { inputClass, inputLabelClass } from "@/components/ui/input";
import { itemSizes } from "@/components/ui/item";
import { nativeSelect } from "@/components/ui/native-select";
import { switch_ } from "@/components/ui/switch";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import type { FieldDef, FieldKind } from "../../../livestore/schema";
import { hasOptions, supportsRequired } from "../../fields";
import { hrefFor } from "../../routes";
import { hasChanges, isDraftValid, isTemplateValid } from "./editor";

// Template overview and focused question editing share the same draft state.

/** Answer types, simplest first — the order they are offered in. */
const ANSWER_TYPES: ReadonlyArray<FieldKind> = [
  "textInput",
  "textArea",
  "radio",
  "checkbox",
  "boolean",
];

/** Answer types in the words an observer would use. */
export const answerTypeName = (kind: FieldKind): string => {
  switch (kind) {
    case "textInput":
      return "Text";
    case "textArea":
      return "Long text";
    case "radio":
      return "Single choice";
    case "checkbox":
      return "Multiple choice";
    case "boolean":
      return "Yes/No";
  }
};

// ── Model shape expected by the view ───────────────────────────────────────

type EditorModel = {
  readonly showCreate?: boolean;
  readonly editor: {
    readonly id: string;
    readonly name: string;
    readonly isDefault: boolean;
    readonly fields: ReadonlyArray<FieldDef>;
    readonly original: {
      readonly name: string;
      readonly isDefault: boolean;
      readonly fields: ReadonlyArray<FieldDef>;
    };
    readonly isSaving: boolean;
    readonly showAddField: boolean;
    readonly editingFieldId: string | null;
    readonly draft: {
      readonly id: string;
      readonly name: string;
      readonly kind: string;
      readonly isRequired: boolean;
      readonly defaultValue: string;
      readonly sortOrder: number;
      readonly options: ReadonlyArray<string>;
      readonly exclusiveOptions: ReadonlyArray<string>;
      readonly newOptionText: string;
    } | null;
    readonly pendingDiscard: boolean;
  } | null;
  readonly lastError: string | null;
};

type Editor = NonNullable<EditorModel["editor"]>;

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
  field: FieldDef,
  index: number,
  total: number,
  isDisabled: boolean,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
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

// ── Question sheet ─────────────────────────────────────────────────────────

/** Why the question can't be saved yet, in the order a person would fix it. */
const draftHint = (draft: Editor["draft"] & object): string => {
  if (draft.name.trim().length === 0) return "Name the question to save it.";
  if (hasOptions(draft.kind as FieldKind) && draft.options.length < 2)
    return "Add at least two choices.";
  if (draft.kind === "checkbox" && draft.options.some((option) => option.includes(",")))
    return "Choices can’t contain commas.";
  return "Finish the question to save it.";
};

const answerTypeList = (kind: FieldKind, h: HtmlBuilder<Message>) =>
  nativeSelect(
    {
      id: "answer-type",
      label: "Answer type",
      wrapperClass: "[&>[data-slot=native-select-wrapper]]:w-full",
      value: kind,
      onChange: (value) => Message.ChangedFieldKind({ kind: value }),
      options: ANSWER_TYPES.map((candidate) =>
        h.option([h.Value(candidate)], [answerTypeName(candidate)]),
      ),
    },
    h,
  );

const choiceRow = (
  option: string,
  index: number,
  total: number,
  isExclusive: boolean,
  showExclusive: boolean,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
    option,
    [h.Class(cn(itemSizes.default, "flex w-full flex-wrap items-center"))],
    [
      h.span([h.Class("min-w-0 basis-full break-words text-sm sm:basis-auto sm:flex-1")], [option]),
      ...(showExclusive
        ? [
            switch_(
              {
                id: `choice-exclusive-${index}`,
                isChecked: isExclusive,
                onToggle: () => Message.ToggledExclusiveOption({ index }),
                label: "Clears other choices",
                size: "sm",
                wrapperClass: "flex-1 flex-row-reverse justify-end sm:flex-none",
              },
              h,
            ),
          ]
        : []),
      h.div(
        [h.Class("ml-auto flex shrink-0 items-stretch")],
        [
          moveButton(
            {
              label: `Move choice ${option} up`,
              up: true,
              isDisabled: index === 0,
              onClick: Message.ClickedMoveOption({ index, direction: -1 }),
            },
            h,
          ),
          moveButton(
            {
              label: `Move choice ${option} down`,
              up: false,
              isDisabled: index === total - 1,
              onClick: Message.ClickedMoveOption({ index, direction: 1 }),
            },
            h,
          ),
        ],
      ),
      button(
        {
          variant: "destructive",
          size: "icon",
          onClick: Message.ClickedDeleteOption({ index }),
          attributes: [h.AriaLabel(`Remove choice ${option}`)],
        },
        [icon(h, X, "size-4")],
        h,
      ),
    ],
  );

const choicesSection = (
  draft: NonNullable<Editor["draft"]>,
  kind: FieldKind,
  h: HtmlBuilder<Message>,
) => {
  const trimmed = draft.newOptionText.trim();
  const hasComma = kind === "checkbox" && draft.newOptionText.includes(",");
  const canAdd = trimmed !== "" && !hasComma && !draft.options.includes(trimmed);
  return groupedList(
    {
      header: "Choices",
      footer: `${draft.options.length} choice${draft.options.length === 1 ? "" : "s"}`,
    },
    [
      ...draft.options.map((option, index) =>
        choiceRow(
          option,
          index,
          draft.options.length,
          draft.exclusiveOptions.includes(option),
          kind === "checkbox",
          h,
        ),
      ),
      controlRow(
        [
          h.div(
            [h.Class("flex items-center gap-2")],
            [
              h.label([h.For("new-choice"), h.Class("sr-only")], ["New choice"]),
              h.input([
                h.Id("new-choice"),
                h.Type("text"),
                h.Class(cn(inputClass)),
                h.Value(draft.newOptionText),
                h.Placeholder("Add a choice"),
                h.AriaLabel("New choice"),
                h.Autocomplete("off"),
                h.Autocapitalize("sentences"),
                h.EnterKeyHint("done"),
                h.Attribute("aria-invalid", String(hasComma)),
                h.OnInput((value) => Message.ChangedNewOptionText({ text: value })),
                h.OnKeyDownPreventDefault((key) =>
                  key === "Enter" && canAdd
                    ? Option.some(Message.ConfirmedAddOption())
                    : Option.none(),
                ),
              ]),
              button(
                {
                  size: "lg",
                  className: "shrink-0",
                  isDisabled: !canAdd,
                  onClick: Message.ConfirmedAddOption(),
                  attributes: [h.AriaLabel("Add choice")],
                },
                "Add",
                h,
              ),
            ],
          ),
          ...(hasComma ? [hint("Choices can’t contain commas.", h)] : []),
          ...(draft.options.length < 2 ? [hint("Add at least two choices.", h)] : []),
        ],
        h,
      ),
    ],
    h,
  );
};

const defaultAnswerSection = (
  draft: NonNullable<Editor["draft"]>,
  kind: FieldKind,
  h: HtmlBuilder<Message>,
) => {
  if (kind === "boolean") {
    return groupedList(
      { header: "Default answer", surface: "plain" },
      [
        controlRow(
          [
            switch_(
              {
                id: "question-default-boolean",
                isChecked: draft.defaultValue === "true",
                onToggle: () => Message.ToggledFieldDefaultBoolean(),
                label: "Starts as Yes",
                className: "after:inset-x-0",
                wrapperClass: "flex-row-reverse justify-between gap-4",
              },
              h,
            ),
          ],
          h,
          "p-0",
        ),
      ],
      h,
    );
  }
  return groupedList(
    {
      surface: "plain",
      footer: "Filled in for you; you can still change it.",
    },
    [
      controlRow(
        [
          h.label([h.For("question-default"), h.Class(cn(inputLabelClass))], ["Default answer"]),
          kind === "textArea"
            ? h.textarea([
                h.Id("question-default"),
                h.Class(cn(textareaClass)),
                h.Value(draft.defaultValue),
                h.Placeholder("Leave empty for none"),
                h.Autocapitalize("sentences"),
                h.OnInput((value) => Message.ChangedFieldDefaultValue({ text: value })),
              ])
            : h.input([
                h.Id("question-default"),
                h.Type("text"),
                h.Class(cn(inputClass)),
                h.Value(draft.defaultValue),
                h.Placeholder("Leave empty for none"),
                h.Autocomplete("off"),
                h.Autocapitalize("sentences"),
                h.EnterKeyHint("done"),
                h.OnInput((value) => Message.ChangedFieldDefaultValue({ text: value })),
              ]),
        ],
        h,
        "p-0",
      ),
    ],
    h,
  );
};

const questionForm = (editor: Editor, h: HtmlBuilder<Message>) => {
  const draft = editor.draft;
  if (draft === null) return h.div([], []);
  const isEditing = editor.editingFieldId !== null;
  const kind = draft.kind as FieldKind;
  const valid = isDraftValid(draft as unknown as Parameters<typeof isDraftValid>[0]);

  const actions = actionGroup(
    {
      destructive: isEditing
        ? {
            label: "Delete question",
            onClick: Message.ClickedDeleteField({ id: draft.id }),
            ariaLabel: `Delete question ${draft.name}`,
          }
        : undefined,
      cancel: {
        label: "Cancel",
        onClick: Message.CanceledAddField(),
        ariaLabel: "Cancel editing question",
      },
      confirm: {
        label: isEditing ? "Done editing" : "Add to template",
        onClick: Message.ConfirmedSaveField(),
        isDisabled: !valid,
        ariaLabel: "Save question",
      },
    },
    h,
  );
  return h.section(
    [
      h.Id("question-editor"),
      h.Class("flex min-w-0 scroll-mt-16 flex-col gap-4"),
      h.AriaLabel(isEditing ? "Edit question" : "New question"),
    ],
    [
      h.div(
        [h.Class("flex flex-col gap-5 pb-2")],
        [
          groupedList(
            { surface: "plain" },
            [
              controlRow(
                [
                  h.label([h.For("question-name"), h.Class(cn(inputLabelClass))], ["Question"]),
                  h.input([
                    h.Id("question-name"),
                    h.Type("text"),
                    h.Class(cn(inputClass)),
                    h.Value(draft.name),
                    h.Placeholder("What are you recording?"),
                    h.Autocomplete("off"),
                    h.Autocapitalize("sentences"),
                    h.EnterKeyHint("done"),
                    h.OnInput((value) => Message.ChangedFieldName({ text: value })),
                  ]),
                ],
                h,
                "p-0",
              ),
            ],
            h,
          ),
          answerTypeList(kind, h),
          ...(supportsRequired(kind)
            ? [
                groupedList(
                  {
                    surface: "plain",
                    footer: "The task can’t be recorded until this is answered.",
                  },
                  [
                    controlRow(
                      [
                        switch_(
                          {
                            id: "question-required",
                            isChecked: draft.isRequired,
                            onToggle: () => Message.ToggledFieldRequired(),
                            label: "Must be answered",
                            className: "after:inset-x-0",
                            wrapperClass: "flex-row-reverse justify-end gap-3",
                          },
                          h,
                        ),
                      ],
                      h,
                      "p-0",
                    ),
                  ],
                  h,
                ),
              ]
            : []),
          ...(hasOptions(kind) ? [choicesSection(draft, kind, h)] : []),
          ...(hasOptions(kind) ? [] : [defaultAnswerSection(draft, kind, h)]),
          ...(valid ? [] : [hint(draftHint(draft), h)]),
        ],
      ),
      h.div([h.Class("border-t border-border pt-4")], [actions]),
    ],
  );
};

// ── Public entry ───────────────────────────────────────────────────────────

export const templateEditorPage = (model: EditorModel, h: HtmlBuilder<Message>) => {
  if (model.editor === null) {
    return h.div(
      [h.Class("template-editor flex min-h-full flex-col")],
      [
        navBar({ title: "Template", back: backLink }, h),
        page(
          { className: "pt-6" },
          [
            ...(model.lastError === null
              ? []
              : [notice({ tone: "error", text: model.lastError }, h)]),
            hint("Opening the template…", h),
          ],
          h,
        ),
      ],
    );
  }

  const editor = model.editor;
  const isValid = isTemplateValid(editor);
  const changed = hasChanges(editor as unknown as Parameters<typeof hasChanges>[0]);
  const canSave = isValid && changed && !editor.isSaving && editor.draft === null;
  const saveHint = !isValid ? "Give the template a name to save it." : null;

  return h.div(
    [h.Class("template-editor flex min-h-full flex-col")],
    [
      navBar(
        {
          title:
            editor.draft !== null
              ? editor.editingFieldId === null
                ? "New question"
                : "Edit question"
              : model.showCreate
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
      ),
      page(
        { className: "pt-6", wide: true },
        [
          ...(model.lastError === null
            ? []
            : [notice({ tone: "error", text: model.lastError }, h)]),
          ...(editor.draft !== null
            ? [questionForm(editor, h)]
            : [
                h.div(
                  [
                    h.Class(
                      "grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start",
                    ),
                  ],
                  [
                    groupedList(
                      {
                        header: "1. Template details",
                        footer:
                          "Name your template, then build the questions in the order you’ll answer them.",
                      },
                      [nameRow(editor, h), defaultRow(editor, h)],
                      h,
                    ),
                    h.div(
                      [h.Class("flex min-w-0 flex-col gap-4")],
                      [
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
                                    field,
                                    index,
                                    editor.fields.length,
                                    editor.draft !== null || editor.isSaving,
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
                        ),
                      ],
                    ),
                  ],
                ),
                ...(saveHint === null ? [] : [hint(saveHint, h)]),
              ]),
        ],
        h,
      ),
      ...(editor.pendingDiscard
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
        : []),
    ],
  );
};
