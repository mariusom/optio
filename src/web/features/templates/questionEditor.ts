import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { X, actionGroup, controlRow, groupedList, hint, icon, rowAction } from "@/components/app";
import { button } from "@/components/ui/button";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { nativeSelect } from "@/components/ui/native-select";
import { switch_ } from "@/components/ui/switch";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import type { FieldKind } from "../../../domain/fields";
import { hasOptions, isScalarAnswerValid } from "../../fields";
import { isDraftValid } from "./editor";
import { ANSWER_TYPES, answerTypeName, type Editor } from "./editorTypes";
import { reorderButtons } from "./reorderButtons";

/** Why the question can't be saved yet, in the order a person would fix it. */
const draftHint = (draft: Editor["draft"] & object): string => {
  if (draft.name.trim().length === 0) return "Name the question to save it.";
  if (hasOptions(draft.kind) && draft.options.length < 2) return "Add at least two choices.";
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

/** Compact "Clears others" toggle: a 44px target around a small labelled chip. */
const exclusiveToggle = (
  config: Readonly<{ option: string; index: number; isExclusive: boolean }>,
  h: HtmlBuilder<Message>,
) =>
  h.button(
    [
      h.Type("button"),
      h.Class(
        "group/exclusive flex h-auto min-h-11 shrink-0 items-center self-stretch px-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-ring",
      ),
      h.AriaPressed(String(config.isExclusive)),
      h.AriaLabel(`${config.option} clears others`),
      h.OnClick(Message.ToggledExclusiveOption({ index: config.index })),
    ],
    [
      h.span(
        [
          h.Class(
            cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors motion-reduce:transition-none",
              config.isExclusive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground group-hover/exclusive:border-foreground/30 group-hover/exclusive:text-foreground",
            ),
          ),
        ],
        ["Clears others"],
      ),
    ],
  );

/** One line per choice: name, then compact controls (toggle, reorder, remove). */
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
    [h.Class("flex min-h-11 w-full items-stretch")],
    [
      h.span(
        [h.Class("ml-3 flex min-w-0 flex-1 items-center py-2.5 pr-1 text-sm break-words")],
        [h.span([h.Class("min-w-0 break-words")], [option])],
      ),
      ...(showExclusive ? [exclusiveToggle({ option, index, isExclusive }, h)] : []),
      reorderButtons(
        {
          subject: `choice ${option}`,
          index,
          total,
          up: Message.ClickedMoveOption({ index, direction: -1 }),
          down: Message.ClickedMoveOption({ index, direction: 1 }),
        },
        h,
      ),
      rowAction(
        {
          className: "text-destructive/80 hover:bg-destructive/10 hover:text-destructive",
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
      footer: `${draft.options.length} choice${draft.options.length === 1 ? "" : "s"}${
        kind === "checkbox" ? ". Picking a choice that clears others unticks the rest." : ""
      }`,
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
  if (draft === null) return h.div([]);
  const isEditing = editor.editingFieldId !== null;
  const kind = draft.kind;
  const valid = isDraftValid(draft);

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
        // Named by its visible label ("Add to template" / "Done editing").
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
