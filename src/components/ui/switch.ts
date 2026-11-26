import { Switch } from "@effect/ui-kit";
import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";

/**
 * The @effect/ui-kit Switch emits data-checked / data-unchecked and
 * data-disabled on both the root button and the thumb, as upstream Base UI
 * does (the travel/track variants like group-data-[size=default]/switch:data-checked:*
 * key on the thumb's own attribute), and native `disabled` on the root.
 */

export const switchSizeKeys = ["default", "sm"] as const;
export type SwitchSize = (typeof switchSizeKeys)[number];

/** Upstream switch component string; sizes come from the cn-switch token via
 *  the data-size attribute. */
export const switchClass =
  "data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80 shrink-0 rounded-full border border-transparent focus-visible:ring-3 aria-invalid:ring-3 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:border-transparent data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50";

/** Upstream thumb string; geometry/travel come from the token keyed on
 *  group data-size + data-checked/data-unchecked. */
export const switchThumbClass =
  "bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 pointer-events-none block ring-0 transition-transform";

export const switchLabelClass =
  "flex min-h-11 cursor-pointer items-center text-sm font-medium leading-normal group-data-[disabled]/field:cursor-not-allowed group-data-[disabled]/field:opacity-70";

export const switchDescriptionClass = "text-sm text-muted-foreground";

export const switchWrapperClass = "group/field flex items-center gap-3";

export const switchTextWrapperClass = "flex flex-col gap-1";

export type SwitchConfig<M> = Readonly<{
  id: string;
  isChecked: boolean;
  onToggle: (isChecked: boolean) => M;
  label: string;
  description?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  name?: string;
  value?: string;
  size?: SwitchSize;
  className?: string;
  thumbClass?: string;
  labelClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
}>;

/** Styled switch with label and optional description, built on the
 *  @effect/ui-kit Switch view function (ARIA, data attributes, hidden form
 *  field and click handling). */
const switchView = <M>(config: SwitchConfig<M>, h: H<M>): Ui => {
  const isDisabled = config.isDisabled === true;
  const descriptionId = `${config.id}-description`;
  const onToggle = config.onToggle;
  return Switch(h, {
    props: {
      checked: config.isChecked,
      disabled: isDisabled,
      readOnly: config.isReadOnly,
      name: config.name,
      value: config.value,
    },
    onToggle: ({ checked }) => onToggle(checked),
    view: (parts) =>
      h.div
        .class(cn(switchWrapperClass, config.wrapperClass))
        .attr("data-disabled", isDisabled ? "" : undefined)
        .children(
          parts
            .root(
              h.button
                .id(config.id)
                .attr(
                  "aria-describedby",
                  config.description === undefined ? undefined : descriptionId,
                )
                .attr("data-slot", "switch")
                .attr("data-size", config.size ?? "default")
                .class(cn(switchClass, config.className)),
            )
            .children(
              parts.thumb(
                h.span
                  .attr("data-slot", "switch-thumb")
                  .class(cn(switchThumbClass, config.thumbClass)),
              ),
            ),
          h.div
            .class(cn(switchTextWrapperClass))
            .children(
              h.label
                .attr("for", config.id)
                .class(cn(switchLabelClass, config.labelClass))
                .children(config.label),
              config.description === undefined
                ? null
                : h.p
                    .id(descriptionId)
                    .class(cn(switchDescriptionClass, config.descriptionClass))
                    .children(config.description),
            ),
        ),
  });
};

export { switchView as switch_ };
