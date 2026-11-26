import { Array, Order, String } from "effect";
import type { H, Ui } from "@/lib/view";

import { Check, ListX, groupedList, hint, icon, statusPill } from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { isScalarAnswerValid, toggleCheckboxOption } from "../../fields";
import type { RunnerSection, RunnerTask } from "./runner";

const selectedChoiceClass =
  "border-primary bg-primary/8 text-primary dark:border-primary dark:bg-primary/15";

const choiceGridClass =
  "grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(12ch+3rem)),1fr))] gap-2 text-sm";

const choiceBody = (
  options: Readonly<{ label: string; isExclusive: boolean; indicator: Ui }>,
  h: H<Message>,
) => {
  const { label, isExclusive, indicator } = options;
  return h.span
    .class("flex min-h-14 w-full items-center gap-2 px-3 py-2 text-sm leading-snug")
    .children(
      indicator,
      h.span
        .class("min-w-0 flex-1 text-start")
        .attr("dir", "auto")
        .children(
          Array.map(String.split(label, /(\s+)/), (word) =>
            /^\s+$/.test(word)
              ? word
              : h.span.class("inline-block max-w-full break-words").children(word),
          ),
          isExclusive
            ? [
                // Visible on touch too; the button's aria-description carries the meaning.
                h.span
                  .class("flex items-center gap-1 pt-0.5 text-xs font-normal text-muted-foreground")
                  .attr("aria-hidden", "true")
                  .attr("data-slot", "exclusive-hint")
                  .children(icon(h, ListX, "size-3 shrink-0"), "Clears others"),
              ]
            : [],
        ),
    );
};

/** `muted` marks a selected "no answer" choice without the answered accent. */
const checkMark = (isSelected: boolean, h: H<Message>, muted = false) =>
  h.span
    .class(
      cn(
        "grid size-4 shrink-0 place-items-center rounded-full border",
        isSelected && !muted ? "border-primary" : "border-muted-foreground",
      ),
    )
    .attr("aria-hidden", "true")
    .children(
      isSelected
        ? [h.span.class(cn("size-2 rounded-full", muted ? "bg-muted-foreground" : "bg-primary"))]
        : [],
    );

const checkBox = (isSelected: boolean, h: H<Message>) =>
  h.span
    .class(
      cn(
        "grid size-4 shrink-0 place-items-center rounded-sm border transition-colors",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground text-transparent",
      ),
    )
    .attr("aria-hidden", "true")
    .children(icon(h, Check, "size-3.5 stroke-[3] [&_*]:stroke-[3]"));

const singleChoiceGroup = (section: RunnerSection, scope: string, h: H<Message>) =>
  h.div
    .key(`${scope}-${section.id}`)
    .class(section.kind === "rating" ? "grid grid-cols-5 gap-2 text-sm" : choiceGridClass)
    .attr("role", "radiogroup")
    .attr("aria-label", section.name)
    .attr("aria-required", globalThis.String(section.isRequired))
    .children(
      Array.map(section.options, (option) => {
        const isSelected = section.value === option;
        // Yes/no keeps an explicit "no answer" choice; it must not read as an answer.
        const isUnanswered = option === "";
        const label =
          section.kind === "boolean"
            ? option === "true"
              ? "Yes"
              : option === "false"
                ? "No"
                : "Unanswered"
            : option;
        return h.label
          .class(
            buttonClass({
              variant: "outline",
              className: cn(
                "h-auto min-w-0 cursor-pointer whitespace-normal p-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected && !isUnanswered && selectedChoiceClass,
                isUnanswered && "border-dashed text-muted-foreground",
                isSelected && section.kind === "rating" && "ring-2 ring-primary",
              ),
            }),
          )
          .children(
            h.input
              .class("sr-only")
              .attr("type", "radio")
              .attr("name", `${scope}-${section.id}`)
              .value(option)
              .checked(isSelected)
              .attr("aria-label", label)
              .on("change", () =>
                Message.ChangedFieldValue({ taskFieldId: section.id, value: option }),
              ),
            section.kind === "rating"
              ? h.span
                  .class("flex min-h-14 items-center justify-center text-base font-semibold")
                  .children(label)
              : choiceBody(
                  { label, isExclusive: false, indicator: checkMark(isSelected, h, isUnanswered) },
                  h,
                ),
          );
      }),
    );

const multipleChoiceGroup = (section: RunnerSection, h: H<Message>) => {
  const selected = new Set(Array.filter(String.split(section.value, ","), (value) => value !== ""));
  return h.div
    .class(choiceGridClass)
    .attr("role", "group")
    .attr("aria-label", section.name)
    .children(
      Array.map(section.options, (option) => {
        const isSelected = selected.has(option);
        const isExclusive = section.exclusiveOptions.includes(option);
        const nextValue = toggleCheckboxOption(section.value, option, section);
        return h.button
          .attr("type", "button")
          .class(
            buttonClass({
              variant: "outline",
              className: cn(
                "h-auto min-w-0 whitespace-normal p-0",
                isSelected && selectedChoiceClass,
              ),
            }),
          )
          .attr("role", "checkbox")
          .attr("aria-checked", globalThis.String(isSelected))
          .attr("aria-label", option)
          .attr(
            "aria-description",
            isExclusive ? "Selecting this clears all other choices." : undefined,
          )
          .on("click", Message.ChangedFieldValue({ taskFieldId: section.id, value: nextValue }))
          .children(
            choiceBody({ label: option, isExclusive, indicator: checkBox(isSelected, h) }, h),
          );
      }),
    );
};

const textAnswer = (section: RunnerSection, scope: string, h: H<Message>) =>
  h.div.children(
    h.input
      .id(`${scope}-answer-${section.id}`)
      .class(cn(inputClass))
      .value(section.value)
      .attr("placeholder", "Type your answer")
      .attr("aria-label", section.name)
      .attr("aria-required", section.isRequired ? "true" : "false")
      .attr("autocomplete", "off")
      .attr("autocapitalize", "sentences")
      .attr("enterkeyhint", "next")
      .on("input", ({ value }) => Message.ChangedFieldValue({ taskFieldId: section.id, value }))
      .on("blur", Message.BlurredField()),
  );

const notesAnswer = (section: RunnerSection, h: H<Message>) =>
  h.div.children(
    h.textarea
      .class(cn(textareaClass))
      .value(section.value)
      .attr("placeholder", "Add anything worth remembering")
      .attr("aria-label", section.name)
      .attr("aria-required", section.isRequired ? "true" : "false")
      .attr("autocomplete", "off")
      .attr("autocapitalize", "sentences")
      .attr("rows", "3")
      .on("input", ({ value }) => Message.ChangedFieldValue({ taskFieldId: section.id, value }))
      .on("blur", Message.BlurredField()),
  );

const numericAnswer = (section: RunnerSection, h: H<Message>) => {
  const valid = isScalarAnswerValid(section.kind, section.value);
  const counter = section.kind === "counter";
  return h.div.children(
    h.div.class("flex items-center gap-2").children(
      counter ? [counterButton({ section, delta: -1, valid }, h)] : [],
      h.input
        .attr("type", "text")
        .class(cn(inputClass, counter && "text-center tabular-nums"))
        .value(section.value)
        .attr("placeholder", "Unanswered")
        .attr("aria-label", section.name)
        .attr("inputmode", counter ? "numeric" : "decimal")
        .attr("aria-required", globalThis.String(section.isRequired))
        .attr("aria-invalid", globalThis.String(!valid))
        .on("input", ({ value }) => Message.ChangedFieldValue({ taskFieldId: section.id, value }))
        .on("blur", Message.BlurredField()),
      counter ? [counterButton({ section, delta: 1, valid }, h)] : [],
    ),
    !valid
      ? [
          hint(
            counter
              ? "Enter a whole number of zero or more."
              : "Enter a valid number, such as 12.5.",
            h,
          ),
        ]
      : [],
  );
};

const counterButton = (
  options: Readonly<{ section: RunnerSection; delta: -1 | 1; valid: boolean }>,
  h: H<Message>,
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
      attrs: { "aria-label": `${delta < 0 ? "Decrease" : "Increase"} ${section.name}` },
    },
    delta < 0 ? "−" : "+",
    h,
  );
};

const answerControl = (section: RunnerSection, scope: string, h: H<Message>) => {
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

const ratingAnswer = (section: RunnerSection, scope: string, h: H<Message>) =>
  h.div.class("space-y-2").children(
    singleChoiceGroup({ ...section, options: ["1", "2", "3", "4", "5"] }, scope, h),
    button(
      {
        variant: "ghost",
        isDisabled: section.value === "",
        onClick: Message.ChangedFieldValue({ taskFieldId: section.id, value: "" }),
        attrs: { "aria-label": `Clear ${section.name}` },
      },
      section.value === "" ? "Unanswered" : "Clear answer",
      h,
    ),
  );

const questionView = (section: RunnerSection, scope: string, h: H<Message>) =>
  section.kind === "textInput"
    ? h.div
        .id(`${scope}-${section.id}`)
        .class(cn(inlineFieldClass, "max-md:grid-cols-1 max-md:gap-y-2"))
        .children(
          h.label
            .attr("for", `${scope}-answer-${section.id}`)
            .class(cn(inputLabelClass, "flex-wrap max-md:font-semibold"))
            .children(
              h.span
                .class("min-w-0 max-w-full break-words")
                .attr("dir", "auto")
                .children(section.name),
              section.isRequired ? [statusPill({}, ["Required"], h)] : [],
            ),
          textAnswer(section, scope, h),
        )
    : groupedList(
        {
          surface: "plain",
          header: h.span
            .class("flex flex-wrap items-center gap-2 normal-case")
            .children(
              h.span
                .class("min-w-0 text-sm font-semibold tracking-normal")
                .attr("dir", "auto")
                .children(section.name),
              section.isRequired ? [statusPill({}, ["Required"], h)] : [],
              section.kind === "radio" || section.kind === "checkbox"
                ? [
                    h.span
                      .class("ml-auto text-xs font-normal text-muted-foreground")
                      .children(section.kind === "radio" ? "Choose one" : "Choose any"),
                  ]
                : [],
            ),
          attrs: { id: `${scope}-${section.id}` },
        },
        [answerControl(section, scope, h)],
        h,
      );

const bySortOrder = Order.mapInput(Order.Number, (section: RunnerSection) => section.sortOrder);

export const formSectionsView = (
  task: RunnerTask,
  h: H<Message>,
  options: Readonly<{ scope?: string }> = {},
) => {
  const scope = options.scope ?? "mobile";
  const sections = Array.sort(task.sections, bySortOrder);
  return h.div.class("mx-auto flex w-full max-w-3xl flex-col gap-6 px-safe pt-6 pb-8").children(
    h.div.class("h-0 w-full scroll-mt-16").id(`${scope}-formTop`),
    Array.map(sections, (section) => questionView(section, scope, h)),
  );
};
