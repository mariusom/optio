import { Checkbox as FoldkitCheckbox } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import { icon } from "@/lib/icons";
import { Check, Minus } from "lucide";
import { cn } from "@/lib/utils";

/**
 * foldkit delta (inlined at style resolution): foldkit emits
 * aria-disabled/data-disabled instead of native disabled, and data-checked /
 * data-indeterminate for state.
 *
 */

/** Upstream checkbox component string. The disabled: variants are inert under
 *  foldkit (never native disabled) — compat twins are inlined at style resolution. */
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

/** Styled checkbox with label and optional description, built on the
 *  @foldkit/ui Checkbox helper. */
export const checkbox = <M>(config: CheckboxConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitCheckbox.view<M>(
    {
      id: config.id,
      isChecked: config.isChecked,
      onToggle: config.onToggle,
      isDisabled: config.isDisabled,
      isReadOnly: config.isReadOnly,
      isIndeterminate: config.isIndeterminate,
      name: config.name,
      value: config.value,
      toView: (attributes) =>
        h.div(
          [h.Class(cn("flex flex-col gap-1", config.wrapperClass))],
          [
            h.div(
              [h.Class("flex items-center gap-2")],
              [
                h.button(
                  [
                    ...attributes.checkbox,
                    h.DataAttribute("slot", "checkbox"),
                    h.Class(cn(checkboxClass, config.className)),
                  ],
                  config.isChecked || config.isIndeterminate === true
                    ? [
                        h.span(
                          [
                            h.DataAttribute("slot", "checkbox-indicator"),
                            h.Class(checkboxIndicatorClass),
                          ],
                          [icon(h, config.isIndeterminate === true ? Minus : Check, "size-3.5")],
                        ),
                      ]
                    : [],
                ),
                ...(attributes.hiddenInput.length > 0
                  ? [h.input([...attributes.hiddenInput])]
                  : []),
                h.label(
                  [
                    ...attributes.label,
                    h.Class(
                      cn(
                        "text-sm font-medium leading-none peer-aria-disabled:cursor-not-allowed peer-aria-disabled:opacity-70 peer-data-[disabled]:opacity-70",
                        config.labelClass,
                      ),
                    ),
                  ],
                  [config.label],
                ),
              ],
            ),
            config.description === undefined
              ? h.empty
              : h.p(
                  [
                    ...attributes.description,
                    h.Class(cn("text-sm text-muted-foreground", config.descriptionClass)),
                  ],
                  [config.description],
                ),
          ],
        ),
    },
    h,
  );
