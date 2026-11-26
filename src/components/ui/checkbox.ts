import type { H, Ui } from "@/lib/view";

import { icon } from "@/lib/icons";
import { Check, Minus } from "lucide";
import { cn } from "@/lib/utils";

/**
 * Delta from upstream (inlined at style resolution): the button emits
 * aria-disabled/data-disabled instead of native disabled, and data-checked /
 * data-indeterminate for state.
 */

/** Upstream checkbox component string. The disabled: variants are inert here
 *  (never native disabled) — compat twins are inlined at style resolution. */
export const checkboxClass =
  "border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 items-center justify-center rounded-[4px] border transition-colors group-has-disabled/field:opacity-50 focus-visible:ring-3 aria-invalid:ring-3 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input group-has-[:focus-visible]/field-label:data-checked:border-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50";

export const checkboxIndicatorClass =
  "[&>svg]:size-3.5 grid place-content-center text-current transition-none";

export type CheckboxConfig<M> = Readonly<{
  id: string;
  isChecked: boolean;
  onToggle: (isChecked: boolean) => M;
  label: string;
  description?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isIndeterminate?: boolean;
  name?: string;
  value?: string;
  className?: string;
  labelClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
}>;

/** The checkbox button's ARIA, state and slot attributes. */
const checkboxAttrs = <M>(config: CheckboxConfig<M>) => {
  const isDisabled = config.isDisabled === true;
  const isReadOnly = config.isReadOnly === true;
  const isIndeterminate = config.isIndeterminate === true;
  return {
    type: "button",
    role: "checkbox",
    "aria-checked": isIndeterminate ? "mixed" : String(config.isChecked),
    "aria-describedby": config.description === undefined ? undefined : `${config.id}-description`,
    "aria-disabled": isDisabled ? "true" : undefined,
    "aria-readonly": isReadOnly ? "true" : undefined,
    "data-checked": !isIndeterminate && config.isChecked ? "" : undefined,
    "data-indeterminate": isIndeterminate ? "" : undefined,
    "data-disabled": isDisabled ? "" : undefined,
    "data-readonly": isReadOnly ? "" : undefined,
    "data-slot": "checkbox",
  };
};

/** Styled checkbox with label and optional description: a native
 *  `<button role="checkbox">` the root Model controls. The kit's Checkbox is a
 *  headless Component instance, so the ARIA, data and form wiring live here. */
export const checkbox = <M>(config: CheckboxConfig<M>, h: H<M>): Ui => {
  const isDisabled = config.isDisabled === true;
  const isReadOnly = config.isReadOnly === true;
  const isIndeterminate = config.isIndeterminate === true;
  const isInteractive = !isDisabled && !isReadOnly;
  const descriptionId = `${config.id}-description`;
  const root = h.button
    .id(config.id)
    .attrs(checkboxAttrs(config))
    .class(cn(checkboxClass, config.className))
    .children(
      config.isChecked || isIndeterminate
        ? h.span
            .attr("data-slot", "checkbox-indicator")
            .class(cn(checkboxIndicatorClass))
            .children(icon(h, isIndeterminate ? Minus : Check, "size-3.5"))
        : null,
    );
  return h.div.class(cn("flex flex-col gap-1", config.wrapperClass)).children(
    h.div.class("flex items-center gap-2").children(
      isInteractive ? root.on("click", config.onToggle(!config.isChecked)) : root,
      config.name === undefined
        ? null
        : h.input
            .attr("type", "hidden")
            .attr("name", config.name)
            .value(config.isChecked ? (config.value ?? "on") : ""),
      h.label
        .attr("for", config.id)
        .class(
          cn(
            "text-sm font-medium leading-none peer-aria-disabled:cursor-not-allowed peer-aria-disabled:opacity-70 peer-data-[disabled]:opacity-70",
            config.labelClass,
          ),
        )
        .children(config.label),
    ),
    config.description === undefined
      ? null
      : h.p
          .id(descriptionId)
          .class(cn("text-sm text-muted-foreground", config.descriptionClass))
          .children(config.description),
  );
};
