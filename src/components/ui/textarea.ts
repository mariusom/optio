import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";

export const textareaClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-md border bg-transparent px-3 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-disabled:bg-input/50 data-disabled:bg-input/50 dark:aria-disabled:bg-input/80 dark:data-disabled:bg-input/80 flex field-sizing-content min-h-24 w-full outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50";

/** Same string as the `label` item's component classes (upstream label.tsx). */
/** Upstream string re-keyed for Optio's markup: the label precedes the control, so
 *  upstream's native peer-disabled sibling variant can never match; disabled
 *  state flows from the wrapper (group/field + data-disabled, mirroring
 *  switch.ts). */
export const textareaLabelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none group-data-[disabled]/field:pointer-events-none group-data-[disabled]/field:cursor-not-allowed group-data-[disabled]/field:opacity-50";

export const textareaDescriptionClass = "text-sm text-muted-foreground";

export const textareaWrapperClass = "group/field flex flex-col gap-1.5 w-full";

export type TextareaConfig<M> = Readonly<{
  id: string;
  label: string;
  description?: string;
  onInput?: (value: string) => M;
  value?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isAutofocus?: boolean;
  name?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
  labelClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
}>;

/** Styled native textarea with label and optional description (the kit has
 *  no textarea view function). */
export const textarea = <M>(config: TextareaConfig<M>, h: H<M>): Ui => {
  const isDisabled = config.isDisabled === true;
  const isReadOnly = config.isReadOnly === true;
  const descriptionId = `${config.id}-description`;
  const onInput = config.onInput;
  const control = h.textarea
    .id(config.id)
    .attrs({
      name: config.name,
      rows: config.rows === undefined ? undefined : String(config.rows),
      placeholder: config.placeholder,
      readonly: isReadOnly ? "" : undefined,
      "data-readonly": isReadOnly ? "" : undefined,
      "data-disabled": isDisabled ? "" : undefined,
      "aria-invalid": config.isInvalid === true ? "true" : undefined,
      "data-invalid": config.isInvalid === true ? "" : undefined,
      "aria-describedby": config.description === undefined ? undefined : descriptionId,
      autofocus: config.isAutofocus === true ? "" : undefined,
      "data-slot": "textarea",
    })
    .disabled(isDisabled)
    .class(cn(textareaClass, config.className));
  const valued = config.value === undefined ? control : control.value(config.value);
  return h.div
    .class(cn(textareaWrapperClass, config.wrapperClass))
    .attr("data-disabled", isDisabled ? "" : undefined)
    .children(
      h.label
        .attr("for", config.id)
        .attr("data-slot", "label")
        .class(cn(textareaLabelClass, config.labelClass))
        .children(config.label),
      onInput === undefined || isDisabled || isReadOnly
        ? valued
        : valued.on("input", ({ value }) => onInput(value)),
      config.description === undefined
        ? null
        : h.span
            .id(descriptionId)
            .class(cn(textareaDescriptionClass, config.descriptionClass))
            .children(config.description),
    );
};
