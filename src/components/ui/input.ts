import { Input } from "@effect/ui-kit";
import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";

export const inputClass =
  "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-11 rounded-md border bg-transparent px-3 py-2 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-disabled:bg-input/50 data-disabled:bg-input/50 dark:aria-disabled:bg-input/80 dark:data-disabled:bg-input/80 w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

/** Same string as the `label` item's component classes (upstream label.tsx). */
/** Upstream string re-keyed for Optio's markup: the label precedes the control, so
 *  upstream's native peer-disabled sibling variant can never match; disabled
 *  state flows from the wrapper (group/field + data-disabled, mirroring
 *  switch.ts). */
export const inputLabelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none group-data-[disabled]/field:pointer-events-none group-data-[disabled]/field:cursor-not-allowed group-data-[disabled]/field:opacity-50";

export const inputDescriptionClass = "text-sm text-muted-foreground";

/** Compact label/control pair; descriptions occupy the full row below it. */
export const inlineFieldClass =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-x-4 gap-y-1.5 [&>*]:min-w-0 [&>label]:leading-snug [&>label]:break-words";

export const inputWrapperClass = `group/field w-full ${inlineFieldClass}`;

export type InputConfig<M> = Readonly<{
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
  type?: string;
  placeholder?: string;
  className?: string;
  labelClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
}>;

/** Styled text input with label and optional description, built on the
 *  @effect/ui-kit Input view function. The kit owns the `value` property and
 *  the disabled state; `value` defaults to an empty string. */
export const input = <M>(config: InputConfig<M>, h: H<M>): Ui => {
  const isDisabled = config.isDisabled === true;
  const descriptionId = `${config.id}-description`;
  const control = h.input.id(config.id).attrs({
    type: config.type ?? "text",
    name: config.name,
    placeholder: config.placeholder,
    readonly: config.isReadOnly === true ? "" : undefined,
    "data-readonly": config.isReadOnly === true ? "" : undefined,
    "aria-invalid": config.isInvalid === true ? "true" : undefined,
    "data-invalid": config.isInvalid === true ? "" : undefined,
    "aria-describedby": config.description === undefined ? undefined : descriptionId,
    autofocus: config.isAutofocus === true ? "" : undefined,
    "data-slot": "input",
  });
  const onInput = config.onInput;
  return h.div
    .class(cn(inputWrapperClass, config.wrapperClass))
    .attr("data-disabled", isDisabled ? "" : undefined)
    .children(
      h.label
        .attr("for", config.id)
        .attr("data-slot", "label")
        .class(cn(inputLabelClass, config.labelClass))
        .children(config.label),
      Input(h, {
        element: control,
        props: { value: config.value ?? "", disabled: isDisabled },
        ...(onInput === undefined ? {} : { onUpdate: ({ value }) => onInput(value) }),
      }).class(cn(inputClass, config.className)),
      config.description === undefined
        ? null
        : h.span
            .id(descriptionId)
            .class(cn(inputDescriptionClass, "col-span-2", config.descriptionClass))
            .children(config.description),
    );
};
