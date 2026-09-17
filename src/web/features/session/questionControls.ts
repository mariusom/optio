import type { Html, HtmlBuilder } from "foldkit/html";

import { Check, ListX, groupedList, icon, statusPill } from "@/components/app";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { switchClass, switchThumbClass } from "@/components/ui/switch";
import { textareaClass } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { isBooleanTrue, toggleCheckboxOption } from "../../fields";
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
  h.div(
    [
      h.Class(choiceGridClass),
      h.Role("radiogroup"),
      h.AriaLabel(section.name),
      h.Attribute("aria-required", String(section.isRequired)),
    ],
    section.options.map((option) => {
      const isSelected = section.value === option;
      return h.label(
        [
          h.Class(
            buttonClass({
              variant: "outline",
              className: cn(
                "h-auto min-w-0 cursor-pointer whitespace-normal p-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                isSelected && "border-primary bg-primary/8 text-primary",
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
            h.AriaLabel(option),
            h.OnChange(() => Message.ChangedFieldValue({ taskFieldId: section.id, value: option })),
          ]),
          choiceBody({ label: option, isExclusive: false, indicator: checkMark(isSelected, h) }, h),
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

const textAnswer = (section: RunnerSection, h: HtmlBuilder<Message>) =>
  h.div(
    [],
    [
      h.input([
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

const yesNoAnswer = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) => {
  const isOn = isBooleanTrue(section.value);
  return h.button(
    [
      h.Type("button"),
      h.Role("switch"),
      h.AriaChecked(isOn),
      h.Attribute("aria-labelledby", `${scope}-runner-toggle-${section.id}-label`),
      h.Class(
        "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      ),
      h.OnClick(
        Message.ChangedFieldValue({ taskFieldId: section.id, value: isOn ? "false" : "true" }),
      ),
    ],
    [
      h.span(
        [
          h.Id(`${scope}-runner-toggle-${section.id}-label`),
          h.Class("min-w-0 flex-1 text-sm font-semibold"),
        ],
        [section.name],
      ),
      ...(section.isRequired ? [statusPill({ tone: "primary" }, ["Required"], h)] : []),
      h.span([h.Class("text-sm text-muted-foreground"), h.AriaHidden(true)], [isOn ? "Yes" : "No"]),
      h.span(
        [
          h.Class(cn(switchClass, "pointer-events-none")),
          h.DataAttribute("size", "default"),
          h.DataAttribute(isOn ? "checked" : "unchecked", ""),
          h.AriaHidden(true),
        ],
        [
          h.span([
            h.Class(cn(switchThumbClass)),
            h.DataAttribute(isOn ? "checked" : "unchecked", ""),
          ]),
        ],
      ),
    ],
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
      return yesNoAnswer(section, scope, h);
    default:
      return textAnswer(section, h);
  }
};

const questionView = (section: RunnerSection, scope: string, h: HtmlBuilder<Message>) =>
  groupedList(
    {
      surface: section.kind === "boolean" ? "card" : "plain",
      header:
        section.kind === "boolean"
          ? undefined
          : h.span(
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
