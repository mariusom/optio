import { RadioGroup as FoldkitRadioGroup } from "@foldkit/ui";
import type { Option } from "effect/Option";
import type { Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";

/**
 * Two rendering paths in `styledViewInputs`:
 *  - `optionLabel` (+ optional `optionDescription`) → upstream anatomy: a
 *    16px circle control carrying the foldkit attributes, an indicator dot
 *    mounted only while selected, and a wired label/description pair.
 *  - legacy `option` callback → consumer-owned row content inside a
 *    group-attributed wrapper (kept for backward compatibility).
 *
 */

// Re-export the @foldkit/ui RadioGroup surface. Create a bundle once per
// option type:
//
//   export const PlanRadioGroup = RadioGroup.create<"Startup" | "Business">()

export const create = FoldkitRadioGroup.create;
export const init = FoldkitRadioGroup.init;
export const Model = FoldkitRadioGroup.Model;
export type Model = typeof Model.Type;
export const Message = FoldkitRadioGroup.Message;
export type Message = typeof Message.Type;
export const OutMessage = FoldkitRadioGroup.OutMessage;
export type OutMessage = typeof OutMessage.Type;

export type Bundle<Value extends string = string> = FoldkitRadioGroup.Bundle<Value>;
export type InitConfig = FoldkitRadioGroup.InitConfig;
export type ViewInputs<Value extends string = string> = FoldkitRadioGroup.ViewInputs<Value>;
export type RenderInfo<Value extends string = string> = FoldkitRadioGroup.RenderInfo<Value>;

/** Upstream group component string. Horizontal orientation appends a
 *  responsive row extension (foldcn API exposes orientation; upstream leaves
 *  layout to the consumer). */
export const radioGroupClass = "grid gap-2 w-full";

export const radioGroupVerticalClass = "grid gap-2 w-full";

export const radioGroupHorizontalClass = "grid gap-2 w-full sm:flex-row sm:items-center";

/** Upstream item component string. The disabled: variants are inert under
 *  foldkit (aria-/data- twins are inlined at style resolution). */
export const radioItemClass =
  "border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 flex size-4 rounded-full focus-visible:ring-3 aria-invalid:ring-3 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input group-has-[:focus-visible]/field-label:data-checked:border-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50";

export const radioIndicatorClass = "flex size-4 items-center justify-center";

export const radioDotClass =
  "bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full";

/** Label for the upstream-anatomy option row. The circle control (radioItemClass)
 *  carries `peer` and precedes the label, and foldkit emits aria-disabled/
 *  data-disabled on it when disabled — so the peer twins below are live
 *  (upstream's native peer-disabled variant can never match). */
export const radioItemLabelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none peer-aria-disabled:pointer-events-none peer-aria-disabled:cursor-not-allowed peer-data-[disabled]:pointer-events-none peer-data-[disabled]:cursor-not-allowed";

export const radioItemDescriptionClass = "text-sm text-muted-foreground";

/** Legacy consumer-drawn row (used when `option` callback is supplied). */
export const radioOptionClass =
  "group/radio-group-item peer relative flex cursor-pointer select-none items-center justify-between rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors after:absolute after:-inset-x-3 after:-inset-y-2 hover:bg-accent hover:text-accent-foreground data-[checked]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** Legacy path label: nested inside the option row (which itself is the
 *  `group/radio-group-item` carrying foldkit's data-disabled), so disabled
 *  state flows via the group variant — a `peer-*` form can never match a
 *  descendant of the peer element. */
export const radioOptionLabelClass =
  "text-sm font-medium leading-none group-data-[disabled]/radio-group-item:cursor-not-allowed group-data-[disabled]/radio-group-item:opacity-70";

export const radioOptionDescriptionClass = "text-sm text-muted-foreground";

export type StyledViewInputs<M, Value extends string = string> = Readonly<{
  options: ReadonlyArray<Value>;
  selectedValue: Option<Value>;
  ariaLabel: string;
  /** Legacy path: renders each option row's content yourself. Receives the
   *  option value, its per-option render info (`isSelected`, attribute
   *  bundles) and the full render. Mutually exclusive with `optionLabel`. */
  option?: (
    value: Value,
    info: FoldkitRadioGroup.OptionInfo<Value>,
    render: RenderInfo<Value>,
    h: HtmlBuilder<M>,
  ) => Html;
  /** Upstream-anatomy path: plain text label per option, rendered next to a
   *  circle control with the indicator dot. */
  optionLabel?: (value: Value) => string;
  optionDescription?: (value: Value) => string;
  orientation?: "Horizontal" | "Vertical";
  isOptionDisabled?: (value: Value, index: number) => boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  name?: string;
  groupClass?: string;
  optionClass?: string;
}>;

const defaultOptionRow = <M, Value extends string>(
  info: FoldkitRadioGroup.OptionInfo<Value>,
  labelText: string,
  descriptionText: string | undefined,
  optionClass: string | undefined,
  h: HtmlBuilder<M>,
): Html =>
  h.label(
    [h.Class(cn("flex w-full items-center gap-2", optionClass))],
    [
      h.button(
        [...info.option, h.DataAttribute("slot", "radio-group-item"), h.Class(radioItemClass)],
        info.isSelected
          ? [
              h.span(
                [h.DataAttribute("slot", "radio-group-indicator"), h.Class(radioIndicatorClass)],
                [h.span([h.Class(radioDotClass)])],
              ),
            ]
          : [],
      ),
      h.span(
        [
          ...info.label,
          h.DataAttribute("slot", "radio-group-item-label"),
          h.Class(radioItemLabelClass),
        ],
        [labelText],
      ),
      ...(descriptionText === undefined
        ? []
        : [
            h.span(
              [
                ...info.description,
                h.DataAttribute("slot", "radio-group-item-description"),
                h.Class(radioItemDescriptionClass),
              ],
              [descriptionText],
            ),
          ]),
    ],
  );

/** Build styled `RadioGroup.ViewInputs`. Pass your view's `h`. */
export const styledViewInputs = <M, Value extends string = string>(
  viewInputs: StyledViewInputs<M, Value>,
  h: HtmlBuilder<M>,
): ViewInputs<Value> => {
  const isHorizontal = viewInputs.orientation === "Horizontal";
  return {
    options: viewInputs.options,
    selectedValue: viewInputs.selectedValue,
    ariaLabel: viewInputs.ariaLabel,
    orientation: viewInputs.orientation,
    isOptionDisabled: viewInputs.isOptionDisabled,
    isDisabled: viewInputs.isDisabled,
    isReadOnly: viewInputs.isReadOnly,
    name: viewInputs.name,
    toView: (render) => {
      const { group, options, hiddenInput } = render;
      return h.div(
        [
          ...group,
          h.DataAttribute("slot", "radio-group"),
          h.Class(
            cn(
              isHorizontal ? radioGroupHorizontalClass : radioGroupVerticalClass,
              viewInputs.groupClass,
            ),
          ),
        ],
        [
          ...options.map((option) => {
            if (viewInputs.option !== undefined) {
              // Legacy path: consumer-owned content inside the attributed row.
              return h.div(
                [
                  ...option.option,
                  h.DataAttribute("slot", "radio-group-item"),
                  h.Class(cn(radioOptionClass, viewInputs.optionClass)),
                ],
                [viewInputs.option(option.value, option, render, h)],
              );
            }
            return defaultOptionRow(
              option,
              viewInputs.optionLabel?.(option.value) ?? String(option.value),
              viewInputs.optionDescription?.(option.value),
              viewInputs.optionClass,
              h,
            );
          }),
          ...(hiddenInput.length > 0 ? [h.input([...hiddenInput])] : []),
        ],
      );
    },
  };
};
