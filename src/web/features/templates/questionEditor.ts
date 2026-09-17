import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import {
  ArrowDown,
  ArrowUp,
  X,
  actionGroup,
  controlRow,
  groupedList,
  hint,
  icon,
  rowAction,
} from "@/components/app";
import { button } from "@/components/ui/button";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { itemSizes } from "@/components/ui/item";
import { nativeSelect } from "@/components/ui/native-select";
import { switch_ } from "@/components/ui/switch";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import type { FieldKind } from "../../../livestore/schema";
import { hasOptions, isScalarAnswerValid } from "../../fields";
import { isDraftValid } from "./editor";
import { ANSWER_TYPES, answerTypeName, type Editor } from "./editorTypes";

const moveButton = (
  config: Readonly<{ label: string; onClick: Message; isDisabled: boolean; up: boolean }>,
  h: HtmlBuilder<Message>,
) =>
  rowAction(
    {
      isDisabled: config.isDisabled,
      attributes: [h.AriaLabel(config.label)],
      onClick: config.onClick,
    },
    [icon(h, config.up ? ArrowUp : ArrowDown, "size-5")],
    h,
  );

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
  options: Readonly<{
    option: string;
    index: number;
    total: number;
    isExclusive: boolean;
    showExclusive: boolean;
  }>,
  h: HtmlBuilder<Message>,
) => {
  const { option, index, total, isExclusive, showExclusive } = options;
  return h.keyed("div")(
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
};

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
          {
            option,
            index,
            total: draft.options.length,
            isExclusive: draft.exclusiveOptions.includes(option),
            showExclusive: kind === "checkbox",
          },
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
            nativeSelect(
              {
                id: "question-default-boolean",
                value: draft.defaultValue,
                onChange: (text) => Message.ChangedFieldDefaultValue({ text }),
                label: "Default answer",
                options: [
                  ["", "Unanswered"],
                  ["true", "Yes"],
                  ["false", "No"],
                ].map(([value, label]) => h.option([h.Value(value!)], [label!])),
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
                h.Attribute(
                  "inputmode",
                  kind === "number"
                    ? "decimal"
                    : kind === "counter" || kind === "rating"
                      ? "numeric"
                      : "text",
                ),
                h.Attribute("aria-invalid", String(!isScalarAnswerValid(kind, draft.defaultValue))),
                h.OnInput((value) => Message.ChangedFieldDefaultValue({ text: value })),
              ]),
          ...(kind === "number"
            ? [hint("A number, including decimals. Put any unit in the question label.", h)]
            : []),
          ...(kind === "counter"
            ? [hint("A whole number of zero or more. Leave empty to start unanswered.", h)]
            : []),
          ...(kind === "rating"
            ? [hint("A whole number from 1 to 5. Describe the scale in the question label.", h)]
            : []),
          ...(!isScalarAnswerValid(kind, draft.defaultValue)
            ? [hint("Enter a valid default answer or leave it empty.", h)]
            : []),
        ],
        h,
        cn("p-0", kind !== "textArea" && inlineFieldClass),
      ),
    ],
    h,
  );
};

export const questionForm = (editor: Editor, h: HtmlBuilder<Message>) => {
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
                cn("p-0", inlineFieldClass),
              ),
            ],
            h,
          ),
          answerTypeList(kind, h),
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
          ...(hasOptions(kind) ? [choicesSection(draft, kind, h)] : []),
          ...(hasOptions(kind) ? [] : [defaultAnswerSection(draft, kind, h)]),
          ...(valid ? [] : [hint(draftHint(draft), h)]),
        ],
      ),
      h.div([h.Class("border-t border-border pt-4")], [actions]),
    ],
  );
};
