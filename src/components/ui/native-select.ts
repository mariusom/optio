import type { H, Ui } from "@/lib/view";

import { icon } from "@/lib/icons";
import { ChevronDown } from "lucide";
import { cn } from "@/lib/utils";
import { inlineFieldClass, inputLabelClass } from "./input";

/** Stateless styled native `<select>` — use when every option is always
 *  visible and plain. For a searchable/filterable dropdown submodel, use
 *  `select` (Listbox-backed) instead. */

export const nativeSelectSizeKeys = ["default", "sm"] as const;
export type NativeSelectSize = (typeof nativeSelectSizeKeys)[number];

/** Upstream NativeSelect select string. */
export const nativeSelectClass =
  "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-11 w-full min-w-0 appearance-none rounded-md border bg-transparent py-2 pr-9 pl-3 text-base md:text-sm transition-colors select-none focus-visible:ring-3 aria-invalid:ring-3 data-[size=sm]:h-9 data-[size=sm]:py-1 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed data-disabled:pointer-events-none data-disabled:cursor-not-allowed outline-none disabled:pointer-events-none disabled:cursor-not-allowed";

/** Upstream NativeSelect wrapper string. */
export const nativeSelectWrapperClass =
  "has-[select[aria-disabled=true]]:opacity-50 has-[select[data-disabled]]:opacity-50 group/native-select relative w-fit has-[select:disabled]:opacity-50";

export const nativeSelectIconClass =
  "text-muted-foreground top-1/2 right-2.5 size-4 -translate-y-1/2 pointer-events-none absolute select-none";

export const nativeSelectOptionClass = "bg-[Canvas] text-[CanvasText]";

export const nativeSelectOptGroupClass = "bg-[Canvas] text-[CanvasText]";

export const nativeSelectLabelClass = inputLabelClass;
export const nativeSelectDescriptionClass = "col-span-2 text-sm text-muted-foreground";
export const nativeSelectFieldWrapperClass = `w-full ${inlineFieldClass}`;

export type NativeSelectConfig<M> = Readonly<{
  id: string;
  label: string;
  description?: string;
  onChange?: (value: string) => M;
  value?: string;
  size?: NativeSelectSize;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isAutofocus?: boolean;
  name?: string;
  /** `<option>` elements — pass prebuilt markup, e.g.
   *  `cities.map((city) => h.option.children(city))`. */
  options: ReadonlyArray<Ui | string>;
  className?: string;
  labelClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
}>;

/** Styled native select with label, chevron and optional description. Mirrors the shadcn v4 `native-select.tsx`:
 *  an `appearance-none` select whose chevron overlays the control at its right
 *  edge. Pass `<option>` markup via `options`.
 *
 *  ```ts
 *  import { nativeSelect } from '@/components/ui/native-select'
 *
 *  nativeSelect(
 *    {
 *      id: 'fruit',
 *      label: 'Fruit',
 *      onChange: (value) => Message.PickedFruit({ value }),
 *      options: fruits.map((fruit) => h.option.attr('value', fruit).children(fruit)),
 *    },
 *    h,
 *  )
 *  ``` */
export const nativeSelect = <M>(config: NativeSelectConfig<M>, h: H<M>): Ui => {
  const isDisabled = config.isDisabled === true;
  const descriptionId = `${config.id}-description`;
  const onChange = config.onChange;
  const control = h.select
    .id(config.id)
    .attrs({
      name: config.name,
      "data-disabled": isDisabled ? "" : undefined,
      "aria-invalid": config.isInvalid === true ? "true" : undefined,
      "data-invalid": config.isInvalid === true ? "" : undefined,
      "aria-describedby": config.description === undefined ? undefined : descriptionId,
      autofocus: config.isAutofocus === true ? "" : undefined,
      "data-slot": "native-select",
      "data-size": config.size ?? "default",
    })
    .disabled(isDisabled)
    .class(cn(nativeSelectClass, config.className))
    .children(config.options);
  const valued = config.value === undefined ? control : control.value(config.value);
  return h.div.class(cn(nativeSelectFieldWrapperClass, config.wrapperClass)).children(
    h.label
      .attr("for", config.id)
      .class(cn(nativeSelectLabelClass, config.labelClass))
      .children(config.label),
    h.div
      .class(cn(nativeSelectWrapperClass))
      .attr("data-slot", "native-select-wrapper")
      .attr("data-size", config.size ?? "default")
      .children(
        onChange === undefined || isDisabled
          ? valued
          : valued.on("change", ({ value }) => onChange(value)),
        h.span
          .attr("data-slot", "native-select-icon")
          .class(cn(nativeSelectIconClass))
          .attr("aria-hidden", "true")
          .children(nativeSelectChevron(h)),
      ),
    config.description === undefined
      ? null
      : h.span
          .id(descriptionId)
          .class(cn(nativeSelectDescriptionClass, config.descriptionClass))
          .children(config.description),
  );
};

export const nativeSelectChevron = <M>(h: H<M>): Ui => icon(h, ChevronDown, "size-4");

/** Helper to render an `<option>` with correct data-slot and Canvas colors. */
export const nativeSelectOption = <M>(
  config: Readonly<{ value: string; label: string; isDisabled?: boolean; className?: string }>,
  h: H<M>,
): Ui =>
  h.option
    .attr("value", config.value)
    .attr("data-slot", "native-select-option")
    .class(cn(nativeSelectOptionClass, config.className))
    .disabled(config.isDisabled === true && true)
    .children(config.label);

/** Helper to render an `<optgroup>` with correct data-slot and Canvas colors. */
export const nativeSelectOptGroup = <M>(
  config: Readonly<{ label: string; className?: string }>,
  children: ReadonlyArray<Ui | string>,
  h: H<M>,
): Ui =>
  h.optgroup
    .attr("data-slot", "native-select-optgroup")
    .class(cn(nativeSelectOptGroupClass, config.className))
    .attr("label", config.label)
    .children(children);
