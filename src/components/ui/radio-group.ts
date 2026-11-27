import { Array, Option } from "effect";
import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";
import {
  fieldBaseClass,
  fieldContentClass,
  fieldDescriptionClass,
  fieldLabelClass,
  fieldOrientationClasses,
  fieldTitleClass,
  labelClass,
} from "./fieldset";

/**
 * A controlled radio group view function over native `<input type="radio">`
 * controls sharing one `name`: the browser supplies arrow-key selection,
 * roving focus (disabled options skipped) and the form value; the caller's
 * Model owns the selection and stores what `onSelect` reports.
 *
 * Two rendering paths:
 *  - `optionLabel` (+ optional `optionDescription`) → upstream anatomy: a
 *    16px circle control, an indicator dot mounted only while selected, and a
 *    wired label/description pair.
 *  - legacy `option` callback → consumer-owned row content inside a
 *    label row carrying a visually hidden radio.
 */

/** Upstream group component string. Horizontal orientation appends a
 *  responsive row extension (foldcn API exposes orientation; upstream leaves
 *  layout to the consumer). */
export const radioGroupClass = "grid gap-2 w-full";

export const radioGroupVerticalClass = "grid gap-2 w-full";

export const radioGroupHorizontalClass = "grid gap-2 w-full sm:flex-row sm:items-center";

/** Upstream item component string, on a native `appearance-none` radio input
 *  (data-checked/data-disabled twins are emitted alongside native state). */
export const radioItemClass =
  "border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 flex size-4 rounded-full focus-visible:ring-3 aria-invalid:ring-3 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input group-has-[:focus-visible]/field-label:data-checked:border-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50";

export const radioIndicatorClass = "flex size-4 items-center justify-center";

export const radioDotClass =
  "bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full";

/** Label for the upstream-anatomy option row. The control wrapper carries
 *  `peer` and data-disabled and precedes the label, so the peer twins below
 *  are live (upstream's native peer-disabled variant can never match). */
export const radioItemLabelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none peer-aria-disabled:pointer-events-none peer-aria-disabled:cursor-not-allowed peer-data-[disabled]:pointer-events-none peer-data-[disabled]:cursor-not-allowed";

export const radioItemDescriptionClass = "text-sm text-muted-foreground";

/** Legacy consumer-drawn row (used when `option` callback is supplied). */
export const radioOptionClass =
  "group/radio-group-item peer relative flex cursor-pointer select-none items-center justify-between rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 hover:bg-accent hover:text-accent-foreground data-[checked]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** Legacy path label: nested inside the option row (which itself is the
 *  `group/radio-group-item` carrying data-disabled), so disabled
 *  state flows via the group variant — a `peer-*` form can never match a
 *  descendant of the peer element. */
export const radioOptionLabelClass =
  "text-sm font-medium leading-none group-data-[disabled]/radio-group-item:cursor-not-allowed group-data-[disabled]/radio-group-item:opacity-70";

export const radioOptionDescriptionClass = "text-sm text-muted-foreground";

/** Per-option state handed to the legacy `option` callback. */
export type OptionInfo<Value extends string = string> = Readonly<{
  value: Value;
  index: number;
  isSelected: boolean;
  isDisabled: boolean;
}>;

export type RadioGroupConfig<M, Value extends string = string> = Readonly<{
  /** Base id; option, label and description ids derive from it. */
  id: string;
  options: ReadonlyArray<Value>;
  selectedValue: Option.Option<Value>;
  /** Sent when the user selects an option (click, label tap or arrow key). */
  onSelect: (value: Value) => M;
  ariaLabel: string;
  /** Legacy path: renders each option row's content yourself. Mutually
   *  exclusive with `optionLabel`. */
  option?: (input: Readonly<{ info: OptionInfo<Value>; h: H<M> }>) => Ui;
  /** Upstream-anatomy path: plain text label per option, rendered next to a
   *  circle control with the indicator dot. */
  optionLabel?: (value: Value) => string;
  optionDescription?: (value: Value) => string;
  optionLayout?: "default" | "field" | "choice-card";
  orientation?: "Horizontal" | "Vertical";
  isOptionDisabled?: (value: Value, index: number) => boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  /** Form field name shared by the radios; defaults to `id`. */
  name?: string;
  groupClass?: string;
  optionClass?: string;
}>;

type Layout = "default" | "field" | "choice-card";

type OptionContent<Value extends string> = Readonly<{
  info: OptionInfo<Value>;
  labelId: string;
  descriptionId: string;
  labelText: string;
  descriptionText?: string;
  optionClass?: string;
  isInvalid?: boolean;
  layout: Layout;
}>;

/** The native radio: checked from the Model, reporting a selection. */
const radioInput = <M, Value extends string>(
  config: RadioGroupConfig<M, Value>,
  option: Readonly<{
    info: OptionInfo<Value>;
    attrs: Readonly<Record<string, string | undefined>>;
    className: string;
  }>,
  h: H<M>,
) => {
  const { info, attrs, className } = option;
  const control = h.input
    .id(`${config.id}-option-${info.index}`)
    .attrs({
      type: "radio",
      name: config.name ?? config.id,
      value: info.value,
      tabindex: info.isDisabled ? "-1" : undefined,
      "aria-invalid": config.isInvalid === true ? "true" : undefined,
      "data-checked": info.isSelected ? "" : undefined,
      "data-disabled": info.isDisabled ? "" : undefined,
      ...attrs,
    })
    .checked(info.isSelected)
    .disabled(info.isDisabled)
    .class(className);
  return info.isDisabled || config.isReadOnly === true
    ? control
    : control.on("change", ({ checked }) => (checked ? config.onSelect(info.value) : undefined));
};

const optionControl = <M, Value extends string>(
  config: RadioGroupConfig<M, Value>,
  content: OptionContent<Value>,
  h: H<M>,
): Ui =>
  h.span
    .attrs({
      "data-slot": "radio-group-item",
      "data-checked": content.info.isSelected ? "" : undefined,
      "data-disabled": content.info.isDisabled ? "" : undefined,
    })
    .class(
      cn(
        "peer relative flex size-4 shrink-0 after:absolute after:-inset-x-3 after:-inset-y-2",
        content.descriptionText !== undefined && content.layout === "default" && "mt-0.5",
      ),
    )
    .children(
      radioInput(
        config,
        {
          info: content.info,
          attrs: {
            "aria-labelledby": content.labelId,
            "aria-describedby":
              content.descriptionText === undefined ? undefined : content.descriptionId,
          },
          className: cn(radioItemClass, "m-0 appearance-none"),
        },
        h,
      ),
      content.info.isSelected
        ? h.span
            .attr("data-slot", "radio-group-indicator")
            .attr("aria-hidden", "true")
            .class(cn(radioIndicatorClass, "pointer-events-none absolute inset-0"))
            .children(h.span.class(cn(radioDotClass)))
        : null,
    );

const optionText = <M, Value extends string>(content: OptionContent<Value>, h: H<M>): Ui => {
  const { labelId, descriptionId, labelText, descriptionText, layout } = content;
  const isField = layout !== "default";
  const label = h.span
    .id(labelId)
    .attr("data-slot", isField ? "field-label" : "radio-group-item-label")
    .class(
      cn(
        layout === "choice-card"
          ? fieldTitleClass
          : isField
            ? cn(
                labelClass,
                fieldLabelClass,
                descriptionText === undefined ? "font-normal" : undefined,
              )
            : radioItemLabelClass,
      ),
    )
    .children(labelText);
  if (descriptionText === undefined && layout !== "choice-card") return label;
  return h.span
    .attr("data-slot", isField ? "field-content" : "radio-group-item-content")
    .class(
      cn(
        isField
          ? fieldContentClass
          : "flex min-w-0 flex-1 flex-col gap-0.5 peer-data-[disabled]:opacity-50",
      ),
    )
    .children(
      label,
      descriptionText === undefined
        ? null
        : h.span
            .id(descriptionId)
            .attr("data-slot", isField ? "field-description" : "radio-group-item-description")
            .class(
              cn(
                isField ? fieldDescriptionClass : radioItemDescriptionClass,
                isField ? "rtl:text-right" : undefined,
              ),
            )
            .children(descriptionText),
    );
};

const defaultOptionRow = <M, Value extends string>(
  config: RadioGroupConfig<M, Value>,
  content: OptionContent<Value>,
  h: H<M>,
): Ui => {
  const { info, descriptionText, optionClass, isInvalid, layout } = content;
  const control = optionControl(config, content, h);
  const text = optionText(content, h);
  const fieldAttrs = {
    "data-slot": "field",
    "data-orientation": "horizontal",
    "data-disabled": info.isDisabled ? "" : undefined,
    "data-invalid": isInvalid === true ? "" : undefined,
  };
  if (layout === "choice-card")
    return h.label
      .attr("data-slot", "field-label")
      .class(cn(labelClass, fieldLabelClass, optionClass))
      .children(
        h.div
          .attrs(fieldAttrs)
          .attr("role", "group")
          .class(cn(fieldBaseClass, fieldOrientationClasses.horizontal))
          .children(text, control),
      );
  return h.label
    .attrs(layout === "field" ? fieldAttrs : {})
    .class(
      cn(
        layout === "field"
          ? cn(fieldBaseClass, fieldOrientationClasses.horizontal)
          : descriptionText === undefined
            ? "flex w-full items-center gap-2"
            : "flex w-full items-start gap-2",
        optionClass,
      ),
    )
    .children(control, text);
};

/** Legacy row: consumer content beside a visually hidden radio; the row
 *  mirrors the radio's state attributes and focus ring. */
const legacyOptionRow = <M, Value extends string>(
  row: Readonly<{
    config: RadioGroupConfig<M, Value>;
    info: OptionInfo<Value>;
    render: NonNullable<RadioGroupConfig<M, Value>["option"]>;
  }>,
  h: H<M>,
): Ui => {
  const { config, info, render } = row;
  return h.label
    .attrs({
      "data-slot": "radio-group-item",
      "data-checked": info.isSelected ? "" : undefined,
      "data-disabled": info.isDisabled ? "" : undefined,
    })
    .class(
      cn(
        radioOptionClass,
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        config.optionClass,
      ),
    )
    .children(
      radioInput(config, { info, attrs: {}, className: "sr-only" }, h),
      render({ info, h }),
    );
};

/** Styled controlled radio group. Pass your view's `h`. */
export const radioGroup = <M, Value extends string = string>(
  config: RadioGroupConfig<M, Value>,
  h: H<M>,
): Ui => {
  const isHorizontal = config.orientation === "Horizontal";
  return h.div
    .id(config.id)
    .attrs({
      role: "radiogroup",
      "aria-label": config.ariaLabel,
      "aria-orientation": isHorizontal ? "horizontal" : "vertical",
      "aria-disabled": config.isDisabled === true ? "true" : undefined,
      "aria-readonly": config.isReadOnly === true ? "true" : undefined,
      "aria-invalid": config.isInvalid === true ? "true" : undefined,
      "data-disabled": config.isDisabled === true ? "" : undefined,
      "data-slot": "radio-group",
    })
    .class(
      cn(isHorizontal ? radioGroupHorizontalClass : radioGroupVerticalClass, config.groupClass),
    )
    .children(
      Array.map(config.options, (value, index) => {
        const info: OptionInfo<Value> = {
          value,
          index,
          isSelected: Option.isSome(config.selectedValue) && config.selectedValue.value === value,
          isDisabled:
            config.isDisabled === true || (config.isOptionDisabled?.(value, index) ?? false),
        };
        if (config.option !== undefined)
          return legacyOptionRow({ config, info, render: config.option }, h);
        return defaultOptionRow(
          config,
          {
            info,
            labelId: `${config.id}-option-${index}-label`,
            descriptionId: `${config.id}-option-${index}-description`,
            labelText: config.optionLabel?.(value) ?? value,
            descriptionText: config.optionDescription?.(value),
            optionClass: config.optionClass,
            isInvalid: config.isInvalid,
            layout: config.optionLayout ?? "default",
          },
          h,
        );
      }),
    );
};
