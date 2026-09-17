import type { Html, HtmlBuilder } from "foldkit/html";

import { Check, ListX, groupedList, hint, icon, statusPill } from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { isScalarAnswerValid, toggleCheckboxOption } from "../../fields";
import type { RunnerSection, RunnerTask } from "./runner";

const choiceGridClass =
  "grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(min(100%,calc(12ch+3rem)),1fr))] gap-2 text-sm";

const choiceBody = (
  options: Readonly<{ label: string; isExclusive: boolean; indicator: Html }>,
  h: HtmlBuilder<Message>,
) => {
  const { label, isExclusive, indicator } = options;
  return h.span(
    [h.Class("relative flex min-h-14 w-full items-center gap-2 px-3 py-2 text-sm leading-snug")],
    [
      indicator,
      h.span(
        [h.Class("min-w-0 flex-1 text-left")],
        label
          .split(/(\s+)/)
          .map((word) =>
            /^\s+$/.test(word)
              ? word
              : h.span([h.Class("inline-block max-w-full break-words")], [word]),
          ),
      ),
      ...(isExclusive
        ? [
            h.span(
              [
                h.Class("absolute right-1 top-1 text-muted-foreground"),
                h.Attribute("title", "Exclusive choice — clears other choices"),
                h.AriaHidden(true),
              ],
              [icon(h, ListX, "size-3")],
            ),
          ]
        : []),
    ],
  );
};

const checkMark = (isSelected: boolean, h: HtmlBuilder<Message>) =>
  h.span(
    [
      h.Class(
        cn(
          "grid size-4 shrink-0 place-items-center rounded-full border",
          isSelected ? "border-primary" : "border-input",
        ),
      ),
      h.AriaHidden(true),
    ],
    isSelected ? [h.span([h.Class("size-2 rounded-full bg-primary")], [])] : [],
  );

const checkBox = (isSelected: boolean, h: HtmlBuilder<Message>) =>
  h.span(
    [
      h.Class(
        cn(
          "grid size-4 shrink-0 place-items-center rounded-sm border transition-colors",
          isSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input text-transparent",
        ),
      ),
      h.AriaHidden(true),
    ],
    [icon(h, Check, "size-3.5 stroke-[3] [&_*]:stroke-[3]")],
  );

const singleChoiceGroup = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    `${scope}-${section.id}`,
    [
      h.Class(section.kind === "rating" ? "grid grid-cols-5 gap-2 text-sm" : choiceGridClass),
      h.Role("radiogroup"),
      h.AriaLabel(section.name),
      h.Attribute("aria-required", String(section.isRequired)),
    ],
    section.options.map((option) => {
      const isSelected = section.value === option;
      const label =
        section.kind === "boolean"
          ? option === "true"
            ? "Yes"
            : option === "false"
              ? "No"
              : "Unanswered"
          : option;
      return h.label(
        [
          h.Class(
            buttonClass({
              variant: "outline",
              className: cn(
                "h-auto min-w-0 cursor-pointer whitespace-normal p-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected && "border-primary bg-primary/8 text-primary",
                isSelected && section.kind === "rating" && "ring-2 ring-primary",
              ),
            }),
          ),
        ],
        [
          h.input([
            h.Class("sr-only"),
            h.Type("radio"),
            h.Name(`${scope}-${section.id}`),
            h.Value(option),
            h.Checked(isSelected),
            h.AriaLabel(label),
            h.OnChange(() => Message.ChangedFieldValue({ taskFieldId: section.id, value: option })),
          ]),
          section.kind === "rating"
            ? h.span(
                [h.Class("flex min-h-14 items-center justify-center text-base font-semibold")],
                [label],
              )
            : choiceBody({ label, isExclusive: false, indicator: checkMark(isSelected, h) }, h),
        ],
      );
    }),
  );

const multipleChoiceGroup = (section: RunnerSection, h: HtmlBuilder<Message>) => {
  const selected = new Set(section.value.split(",").filter((value) => value !== ""));
  return h.div(
    [h.Class(choiceGridClass), h.Role("group"), h.AriaLabel(section.name)],
    section.options.map((option) => {
      const isSelected = selected.has(option);
      const isExclusive = section.exclusiveOptions.includes(option);
      const nextValue = toggleCheckboxOption(section.value, option, section);
      return h.button(
        [
          h.Type("button"),
          h.Class(
            buttonClass({
              variant: "outline",
              className: cn(
                "h-auto min-w-0 whitespace-normal p-0",
                isSelected && "border-primary bg-primary/8 text-primary",
              ),
            }),
          ),
          h.Role("checkbox"),
          h.AriaChecked(isSelected),
          h.AriaLabel(option),
          ...(isExclusive
            ? [h.Attribute("aria-description", "Selecting this clears all other choices.")]
            : []),
          h.OnClick(Message.ChangedFieldValue({ taskFieldId: section.id, value: nextValue })),
        ],
        [choiceBody({ label: option, isExclusive, indicator: checkBox(isSelected, h) }, h)],
      );
    }),
  );
};

const textAnswer = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  h.div(
    [],
    [
      h.input([
        h.Id(`${scope}-answer-${section.id}`),
        h.Class(cn(inputClass)),
        h.Value(section.value),
        h.Placeholder("Type your answer"),
        h.AriaLabel(section.name),
        h.Attribute("aria-required", section.isRequired ? "true" : "false"),
        h.Autocomplete("off"),
        h.Autocapitalize("sentences"),
        h.EnterKeyHint("next"),
        h.OnInput((value) => Message.ChangedFieldValue({ taskFieldId: section.id, value })),
      ]),
    ],
  );

const notesAnswer = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [],
    [
      h.textarea([
        h.Class(cn(textareaClass)),
        h.Value(section.value),
        h.Placeholder("Add anything worth remembering"),
        h.AriaLabel(section.name),
        h.Attribute("aria-required", section.isRequired ? "true" : "false"),
        h.Autocomplete("off"),
        h.Autocapitalize("sentences"),
        h.Attribute("rows", "3"),
        h.OnInput((value) => Message.ChangedFieldValue({ taskFieldId: section.id, value })),
      ]),
    ],
  );

const numericAnswer = (section: RunnerSection, h: HtmlBuilder<Message>) => {
  const valid = isScalarAnswerValid(section.kind, section.value);
  const counter = section.kind === "counter";
  return h.div(
    [],
    [
      h.div(
        [h.Class("flex items-center gap-2")],
        [
          ...(counter ? [counterButton({ section, delta: -1, valid }, h)] : []),
          h.input([
            h.Type("text"),
            h.Class(cn(inputClass, counter && "text-center tabular-nums")),
            h.Value(section.value),
            h.Placeholder("Unanswered"),
            h.AriaLabel(section.name),
            h.Attribute("inputmode", counter ? "numeric" : "decimal"),
            h.Attribute("aria-required", String(section.isRequired)),
            h.Attribute("aria-invalid", String(!valid)),
            h.OnInput((value) => Message.ChangedFieldValue({ taskFieldId: section.id, value })),
          ]),
          ...(counter ? [counterButton({ section, delta: 1, valid }, h)] : []),
        ],
      ),
      ...(!valid
        ? [
            hint(
              counter
                ? "Enter a whole number of zero or more."
                : "Enter a valid number, such as 12.5.",
              h,
            ),
          ]
        : []),
    ],
  );
};

const counterButton = (
  options: Readonly<{ section: RunnerSection; delta: -1 | 1; valid: boolean }>,
  h: HtmlBuilder<Message>,
) => {
  const { section, delta, valid } = options;
  return button(
    {
      onClick: Message.AdjustedCounter({ taskFieldId: section.id, delta }),
      isDisabled:
        !valid ||
        (delta < 0 && (section.value === "" || Number(section.value) <= 0)) ||
        (delta > 0 && Number(section.value) >= Number.MAX_SAFE_INTEGER),
      variant: "outline",
      className: "h-11 w-11 shrink-0",
      attributes: [h.AriaLabel(`${delta < 0 ? "Decrease" : "Increase"} ${section.name}`)],
    },
    delta < 0 ? "−" : "+",
    h,
  );
};

const answerControl = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) => {
  switch (section.kind) {
    case "radio":
      return singleChoiceGroup(section, scope, h);
    case "checkbox":
      return multipleChoiceGroup(section, h);
    case "textArea":
      return notesAnswer(section, h);
    case "boolean":
      return singleChoiceGroup({ ...section, options: ["", "true", "false"] }, scope, h);
    case "number":
    case "counter":
      return numericAnswer(section, h);
    case "rating":
      return ratingAnswer(section, scope, h);
    default:
      return textAnswer(section, scope, h);
  }
};

const ratingAnswer = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("space-y-2")],
    [
      singleChoiceGroup({ ...section, options: ["1", "2", "3", "4", "5"] }, scope, h),
      button(
        {
          variant: "ghost",
          isDisabled: section.value === "",
          onClick: Message.ChangedFieldValue({ taskFieldId: section.id, value: "" }),
          attributes: [h.AriaLabel(`Clear ${section.name}`)],
        },
        section.value === "" ? "Unanswered" : "Clear answer",
        h,
      ),
    ],
  );

const questionView = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  section.kind === "textInput"
    ? h.div(
        [h.Id(`${scope}-${section.id}`), h.Class(cn(inlineFieldClass))],
        [
          h.label(
            [h.For(`${scope}-answer-${section.id}`), h.Class(cn(inputLabelClass, "flex-wrap"))],
            [
              h.span([h.Class("min-w-0 max-w-full break-words")], [section.name]),
              ...(section.isRequired ? [statusPill({ tone: "primary" }, ["Required"], h)] : []),
            ],
          ),
          textAnswer(section, scope, h),
        ],
      )
    : groupedList(
        {
          surface: "plain",
          header: h.span(
            [h.Class("flex flex-wrap items-center gap-2 normal-case")],
            [
              h.span([h.Class("min-w-0 text-sm font-semibold tracking-normal")], [section.name]),
              ...(section.isRequired ? [statusPill({ tone: "primary" }, ["Required"], h)] : []),
              ...(section.kind === "radio" || section.kind === "checkbox"
                ? [
                    h.span(
                      [h.Class("ml-auto text-xs font-normal text-muted-foreground")],
                      [section.kind === "radio" ? "Choose one" : "Choose any"],
                    ),
                  ]
                : []),
            ],
          ),
          attributes: [h.Id(`${scope}-${section.id}`)],
        },
        [answerControl(section, scope, h)],
        h,
      );

export const formSectionsView = (task: RunnerTask, h: HtmlBuilder<Message>, scope = "mobile") => {
  const sections = task.sections.toSorted((a, b) => a.sortOrder - b.sortOrder);
  return h.div(
    [h.Class("mx-auto flex w-full max-w-3xl flex-col gap-6 px-safe pt-4 pb-8")],
    [
      h.div([h.Class("h-0 w-full scroll-mt-16"), h.Id(`${scope}-formTop`)], []),
      ...sections.map((section) => questionView(section, scope, h)),
    ],
  );
};
