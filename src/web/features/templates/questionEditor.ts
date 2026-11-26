import { Array, pipe, String } from "effect";
import type { H } from "@/lib/view";

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
import { newChoiceInputId } from "./choiceInput";
import { reorderButtons } from "./reorderButtons";

/** Why the question can't be saved yet, in the order a person would fix it. */
const draftHint = (draft: Editor["draft"] & object): string => {
  if (String.trim(draft.name).length === 0) return "Name the question to save it.";
  if (hasOptions(draft.kind) && draft.options.length < 2) return "Add at least two choices.";
  if (
    draft.kind === "checkbox" &&
    Array.some(draft.options, (option) => pipe(option, String.includes(",")))
  )
    return "Choices can’t contain commas.";
  return "Finish the question to save it.";
};

const answerTypeList = (kind: FieldKind, h: H<Message>) =>
  nativeSelect(
    {
      id: "answer-type",
      label: "Answer type",
      wrapperClass: "[&>[data-slot=native-select-wrapper]]:w-full",
      value: kind,
      onChange: (value) => Message.ChangedFieldKind({ kind: value }),
      options: Array.map(ANSWER_TYPES, (candidate) =>
        h.option.attr("value", candidate).children(answerTypeName(candidate)),
      ),
    },
    h,
  );

/** Compact "Clears others" toggle: a 44px target around a small labelled chip. */
const exclusiveToggle = (
  config: Readonly<{ option: string; index: number; isExclusive: boolean }>,
  h: H<Message>,
) =>
  h.button
    .attr("type", "button")
    .class(
      "group/exclusive flex h-auto min-h-11 shrink-0 items-center self-stretch px-1 outline-none focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-ring",
    )
    .attr("aria-pressed", globalThis.String(config.isExclusive))
    .attr("aria-label", `${config.option} clears others`)
    .on("click", Message.ToggledExclusiveOption({ index: config.index }))
    .children(
      h.span
        .class(
          cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors motion-reduce:transition-none",
            config.isExclusive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground group-hover/exclusive:border-foreground/30 group-hover/exclusive:text-foreground",
          ),
        )
        .children("Clears others"),
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
  h: H<Message>,
) => {
  const { option, index, total, isExclusive, showExclusive } = options;
  return h.div
    .key(option)
    .class("flex min-h-11 w-full items-stretch")
    .children(
      h.span
        .class("ml-3 flex min-w-0 flex-1 items-center py-2.5 pr-1 text-sm break-words")
        .children(h.span.class("min-w-0 break-words").children(option)),
      showExclusive ? [exclusiveToggle({ option, index, isExclusive }, h)] : [],
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
          // Quiet like the reorder buttons; red only on hover, so a list of choices is not a column of warnings.
          className: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
          onClick: Message.ClickedDeleteOption({ index }),
          attrs: { "aria-label": `Remove choice ${option}` },
        },
        [icon(h, X, "size-4")],
        h,
      ),
    );
};

const choicesSection = (draft: NonNullable<Editor["draft"]>, kind: FieldKind, h: H<Message>) => {
  const trimmed = String.trim(draft.newOptionText);
  const hasComma = kind === "checkbox" && pipe(draft.newOptionText, String.includes(","));
  const canAdd = trimmed !== "" && !hasComma && !draft.options.includes(trimmed);
  return groupedList(
    {
      header: "Choices",
      footer: `${draft.options.length} choice${draft.options.length === 1 ? "" : "s"}${
        kind === "checkbox" ? ". Picking a choice that clears others unticks the rest." : ""
      }`,
    },
    [
      ...Array.map(draft.options, (option, index) =>
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
          h.div.class("flex items-center gap-2").children(
            h.label.attr("for", newChoiceInputId).class("sr-only").children("New choice"),
            h.input
              .id(newChoiceInputId)
              .attr("type", "text")
              .class(cn(inputClass))
              .value(draft.newOptionText)
              .attr("placeholder", "Add a choice")
              .attr("aria-label", "New choice")
              .attr("autocomplete", "off")
              .attr("autocapitalize", "sentences")
              .attr("enterkeyhint", "done")
              .attr("aria-invalid", globalThis.String(hasComma))
              .on("input", ({ value }) => Message.ChangedNewOptionText({ text: value }))
              .on(
                "keydown",
                ({ key }) => (key === "Enter" ? Message.ConfirmedAddOption() : undefined),
                { preventDefault: true },
              ),
            button(
              {
                size: "lg",
                className: "shrink-0",
                isDisabled: !canAdd,
                onClick: Message.ConfirmedAddOption(),
                attrs: { "aria-label": "Add choice" },
              },
              "Add",
              h,
            ),
          ),
          ...(hasComma ? [hint("Choices can’t contain commas.", h)] : []),
        ],
        h,
        // Keyed like the choice rows above it, so adding a choice keeps this
        // input (and its focus) instead of re-creating it.
      ).key("new-choice-row"),
    ],
    h,
  );
};

const defaultAnswerSection = (
  draft: NonNullable<Editor["draft"]>,
  kind: FieldKind,
  h: H<Message>,
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
                options: Array.map(
                  [
                    ["", "Unanswered"],
                    ["true", "Yes"],
                    ["false", "No"],
                  ],
                  ([value, label]) => h.option.attr("value", value!).children(label!),
                ),
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
          h.label
            .attr("for", "question-default")
            .class(cn(inputLabelClass))
            .children("Default answer"),
          kind === "textArea"
            ? h.textarea
                .id("question-default")
                .class(cn(textareaClass))
                .value(draft.defaultValue)
                .attr("placeholder", "Leave empty for none")
                .attr("autocapitalize", "sentences")
                .on("input", ({ value }) => Message.ChangedFieldDefaultValue({ text: value }))
            : h.input
                .id("question-default")
                .attr("type", "text")
                .class(cn(inputClass))
                .value(draft.defaultValue)
                .attr("placeholder", "Leave empty for none")
                .attr("autocomplete", "off")
                .attr("autocapitalize", "sentences")
                .attr("enterkeyhint", "done")
                .attr(
                  "inputmode",
                  kind === "number"
                    ? "decimal"
                    : kind === "counter" || kind === "rating"
                      ? "numeric"
                      : "text",
                )
                .attr(
                  "aria-invalid",
                  globalThis.String(!isScalarAnswerValid(kind, draft.defaultValue)),
                )
                .on("input", ({ value }) => Message.ChangedFieldDefaultValue({ text: value })),
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

export const questionForm = (editor: Editor, h: H<Message>) => {
  const draft = editor.draft;
  if (draft === null) return h.div;
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
  return h.section
    .id("question-editor")
    .class("flex min-w-0 scroll-mt-16 flex-col gap-4")
    .attr("aria-label", isEditing ? "Edit question" : "New question")
    .children(
      h.div.class("flex flex-col gap-4 pb-2").children(
        groupedList(
          { surface: "plain" },
          [
            controlRow(
              [
                h.label
                  .attr("for", "question-name")
                  .class(cn(inputLabelClass))
                  .children("Question"),
                h.input
                  .id("question-name")
                  .attr("type", "text")
                  .class(cn(inputClass))
                  .value(draft.name)
                  .attr("placeholder", "What are you recording?")
                  .attr("autocomplete", "off")
                  .attr("autocapitalize", "sentences")
                  .attr("enterkeyhint", "done")
                  .on("input", ({ value }) => Message.ChangedFieldName({ text: value })),
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
        hasOptions(kind) ? [choicesSection(draft, kind, h)] : [],
        hasOptions(kind) ? [] : [defaultAnswerSection(draft, kind, h)],
        valid ? [] : [hint(draftHint(draft), h)],
      ),
      h.div.class("border-t border-border pt-4").children(actions),
    );
};
