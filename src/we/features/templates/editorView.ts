import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  X,
  choiceRows,
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
  sheet,
  statusPill,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { inputClass, inputLabelClass } from "@/components/ui/input";
import { switch_ } from "@/components/ui/switch";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import type { FieldDef, FieldKind } from "../../../livestore/schema";
import { hasOptions, supportsRequired } from "../../fields";
import { hrefFor } from "../../routes";
import { hasChanges, isDraftValid, isTemplateValid } from "./editor";

// Template editor — a nav bar with Save, a grouped form for the template
// itself and an ordered list of questions. Editing a question happens in a
// sheet, so the list never turns into a nested form.

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
  h.button(
    [
      h.Type("button"),
      h.Class(
        "grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:opacity-60 disabled:opacity-30",
      ),
      h.Disabled(config.isDisabled),
      h.AriaLabel(config.label),
      h.OnClick(config.onClick),
    ],
    [icon(h, config.up ? ArrowUp : ArrowDown, "size-5")],
  );

const questionRow = (field: FieldDef, index: number, total: number, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    field.id,
    [h.Class("lazy-row flex w-full items-stretch")],
    [
      h.button(
        [
          h.Type("button"),
          h.Class(
            "flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2.5 pl-4 text-left text-[1.0625rem] leading-snug transition-colors hover:bg-muted/60 active:bg-muted",
          ),
          h.OnClick(Message.ClickedEditField({ id: field.id })),
          h.AriaLabel(`Edit question ${field.name}`),
        ],
        [
          h.span(
            [h.Class("flex min-w-0 flex-1 flex-col")],
            [
              h.span([h.Class("truncate")], [field.name === "" ? "Untitled question" : field.name]),
              h.span(
                [h.Class("truncate text-[0.9375rem] text-muted-foreground")],
                [answerTypeName(field.kind as FieldKind)],
              ),
            ],
          ),
          ...(field.isRequired ? [statusPill({ tone: "primary" }, ["Required"], h)] : []),
        ],
      ),
      h.div(
        [h.Class("flex shrink-0 items-center self-center pr-1")],
        [
          moveButton(
            {
              label: `Move ${field.name} up`,
              up: true,
              isDisabled: index === 0,
              onClick: Message.ClickedMoveFieldUp({ id: field.id }),
            },
            h,
          ),
          moveButton(
            {
              label: `Move ${field.name} down`,
              up: false,
              isDisabled: index === total - 1,
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
      h.label(
        [
          h.For("template-name"),
          h.Class(cn(inputLabelClass, "text-[0.8125rem] text-muted-foreground")),
        ],
        ["Name"],
      ),
      h.input([
        h.Id("template-name"),
        h.Type("text"),
        h.Class(cn(inputClass, "h-11 rounded-lg text-base")),
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
  choiceRows(
    {
      label: "Answer type",
      header: "Answer type",
      choices: ANSWER_TYPES.map((candidate) => ({
        label: answerTypeName(candidate),
        selected: candidate === kind,
        onSelect: Message.ChangedFieldKind({ kind: candidate }),
      })),
    },
    h,
  );

const choiceRow = (
  option: string,
  index: number,
  isExclusive: boolean,
  showExclusive: boolean,
  h: HtmlBuilder<Message>,
) =>
  h.keyed("div")(
    `choice-${index}-${option}`,
    [h.Class("flex w-full items-center gap-2 px-4 py-2")],
    [
      h.span([h.Class("min-w-0 flex-1 truncate text-[1.0625rem]")], [option]),
      ...(showExclusive
        ? [
            switch_(
              {
                id: `choice-exclusive-${index}`,
                isChecked: isExclusive,
                onToggle: () => Message.ToggledExclusiveOption({ index }),
                label: "Clears other choices",
                size: "sm",
                wrapperClass: "flex-row-reverse gap-2",
                labelClass: "text-[0.8125rem] text-muted-foreground",
              },
              h,
            ),
          ]
        : []),
      h.button(
        [
          h.Type("button"),
          h.Class(
            "grid size-11 shrink-0 place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10 active:opacity-60",
          ),
          h.OnClick(Message.ClickedDeleteOption({ index })),
          h.AriaLabel(`Remove choice ${option}`),
        ],
        [icon(h, X, "size-4")],
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
        choiceRow(option, index, draft.exclusiveOptions.includes(option), kind === "checkbox", h),
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
                h.Class(cn(inputClass, "h-11 rounded-lg text-base")),
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
                  className: "h-11 shrink-0 rounded-lg px-4 text-base font-semibold",
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
      { header: "Default answer" },
      [
        controlRow(
          [
            switch_(
              {
                id: "question-default-boolean",
                isChecked: draft.defaultValue === "true",
                onToggle: () => Message.ToggledFieldDefaultBoolean(),
                label: "Starts as Yes",
                wrapperClass: "flex-row-reverse justify-between gap-4",
              },
              h,
            ),
          ],
          h,
        ),
      ],
      h,
    );
  }
  return groupedList(
    { header: "Default answer", footer: "Filled in for you; you can still change it." },
    [
      controlRow(
        [
          h.label(
            [
              h.For("question-default"),
              h.Class(cn(inputLabelClass, "text-[0.8125rem] text-muted-foreground")),
            ],
            ["Default answer"],
          ),
          kind === "textArea"
            ? h.textarea([
                h.Id("question-default"),
                h.Class(cn(textareaClass, "min-h-20 rounded-lg text-base")),
                h.Value(draft.defaultValue),
                h.Placeholder("Leave empty for none"),
                h.Autocapitalize("sentences"),
                h.OnInput((value) => Message.ChangedFieldDefaultValue({ text: value })),
              ])
            : h.input([
                h.Id("question-default"),
                h.Type("text"),
                h.Class(cn(inputClass, "h-11 rounded-lg text-base")),
                h.Value(draft.defaultValue),
                h.Placeholder("Leave empty for none"),
                h.Autocomplete("off"),
                h.Autocapitalize("sentences"),
                h.EnterKeyHint("done"),
                h.OnInput((value) => Message.ChangedFieldDefaultValue({ text: value })),
              ]),
        ],
        h,
      ),
    ],
    h,
  );
};

const questionSheet = (editor: Editor, h: HtmlBuilder<Message>) => {
  const draft = editor.draft;
  if (draft === null) return h.div([], []);
  const isEditing = editor.editingFieldId !== null;
  const kind = draft.kind as FieldKind;
  const valid = isDraftValid(draft as unknown as Parameters<typeof isDraftValid>[0]);

  return sheet(
    {
      id: "question-editor",
      title: isEditing ? "Edit question" : "New question",
      size: "md",
      onDismiss: Message.CanceledAddField(),
      dismissLabel: "Cancel editing question",
      footer: [
        button(
          {
            size: "lg",
            className: "h-11 text-base font-semibold",
            isDisabled: !valid,
            onClick: Message.ConfirmedSaveField(),
            attributes: [h.AriaLabel("Save question")],
          },
          "Save",
          h,
        ),
        button(
          {
            variant: "secondary",
            size: "lg",
            className: "h-11 text-base",
            onClick: Message.CanceledAddField(),
            attributes: [h.AriaLabel("Cancel editing question")],
          },
          "Cancel",
          h,
        ),
      ],
    },
    [
      h.div(
        [h.Class("flex flex-col gap-5 pb-2")],
        [
          groupedList(
            {},
            [
              controlRow(
                [
                  h.label(
                    [
                      h.For("question-name"),
                      h.Class(cn(inputLabelClass, "text-[0.8125rem] text-muted-foreground")),
                    ],
                    ["Question"],
                  ),
                  h.input([
                    h.Id("question-name"),
                    h.Type("text"),
                    h.Class(cn(inputClass, "h-11 rounded-lg text-base")),
                    h.Value(draft.name),
                    h.Placeholder("What are you recording?"),
                    h.Autocomplete("off"),
                    h.Autocapitalize("sentences"),
                    h.EnterKeyHint("done"),
                    h.Autofocus(true),
                    h.OnInput((value) => Message.ChangedFieldName({ text: value })),
                  ]),
                ],
                h,
              ),
            ],
            h,
          ),
          answerTypeList(kind, h),
          ...(supportsRequired(kind)
            ? [
                groupedList(
                  { footer: "The task can’t be recorded until this is answered." },
                  [
                    controlRow(
                      [
                        switch_(
                          {
                            id: "question-required",
                            isChecked: draft.isRequired,
                            onToggle: () => Message.ToggledFieldRequired(),
                            label: "Must be answered",
                            wrapperClass: "flex-row-reverse justify-between gap-4",
                          },
                          h,
                        ),
                      ],
                      h,
                    ),
                  ],
                  h,
                ),
              ]
            : []),
          ...(hasOptions(kind) ? [choicesSection(draft, kind, h)] : []),
          ...(hasOptions(kind) ? [] : [defaultAnswerSection(draft, kind, h)]),
          ...(isEditing
            ? [
                groupedList(
                  {},
                  [
                    row(
                      {
                        title: "Delete question",
                        destructive: true,
                        leading: icon(h, Trash2, "size-5"),
                        onClick: Message.ClickedDeleteField({ id: draft.id }),
                        attributes: [h.AriaLabel(`Delete question ${draft.name}`)],
                      },
                      h,
                    ),
                  ],
                  h,
                ),
              ]
            : []),
          ...(valid ? [] : [hint(draftHint(draft), h)]),
        ],
      ),
    ],
    h,
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
  const canSave = isValid && changed && !editor.isSaving;
  const saveHint = !isValid
    ? "Give the template a name to save it."
    : !changed
      ? "Nothing to save yet."
      : null;

  return h.div(
    [h.Class("template-editor flex min-h-full flex-col")],
    [
      navBar(
        {
          title: "Template",
          back: guardedBackLink,
          trailing: [
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
        { className: "pt-6" },
        [
          ...(model.lastError === null
            ? []
            : [notice({ tone: "error", text: model.lastError }, h)]),
          groupedList({ header: "Template" }, [nameRow(editor, h), defaultRow(editor, h)], h),
          groupedList(
            {
              header: "Questions",
              footer:
                editor.fields.length === 0
                  ? "Add a question for each thing you note down, such as activity, location or notes."
                  : `${editor.fields.length} question${editor.fields.length === 1 ? "" : "s"}`,
            },
            [
              ...editor.fields.map((field, index) =>
                questionRow(field, index, editor.fields.length, h),
              ),
              row(
                {
                  title: "Add question",
                  leading: icon(h, Plus, "size-5 text-primary"),
                  onClick: Message.ClickedAddField(),
                  className: "text-primary",
                  attributes: [h.AriaLabel("Add question")],
                },
                h,
              ),
            ],
            h,
          ),
          ...(saveHint === null ? [] : [hint(saveHint, h)]),
        ],
        h,
      ),
      ...(editor.draft !== null ? [questionSheet(editor, h)] : []),
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
