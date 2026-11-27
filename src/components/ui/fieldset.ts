import type { H, Ui } from "@/lib/view";
import { Array } from "effect";
import { cn } from "@/lib/utils";
import { separatorClass } from "./separator";

type Child = Ui | string;

export const fieldsetClass =
  "gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3 flex flex-col group/field-set";

export const fieldsetLegendClass =
  "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base";

export const fieldGroupClass =
  "gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4 group/field-group @container/field-group flex w-full flex-col";

/** Upstream cva base + per-orientation variant strings. */
export const fieldBaseClass = "data-invalid:text-destructive gap-2 group/field flex w-full";

export const fieldOrientationClasses = {
  vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
  horizontal:
    "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
  responsive:
    "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
} as const;

export type FieldOrientation = keyof typeof fieldOrientationClasses;

export const fieldContentClass = "gap-0.5 group/field-content flex flex-1 flex-col leading-snug";

/** Upstream keys label disabling on a native peer-disabled sibling variant
 *  (no `.peer` sibling exists) and `group-data-[disabled=true]`
 *  (Optio emits `data-disabled=""`, never "true"). Re-keyed onto the
 *  fieldset wrapper's live group + data-disabled signal. */
export const labelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none group-data-[disabled]/field-set:pointer-events-none group-data-[disabled]/field-set:cursor-not-allowed group-data-[disabled]/field-set:opacity-50";

export const fieldLabelClass =
  "has-data-checked:bg-primary/5 has-data-checked:border-primary/30 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10 gap-2 leading-snug group-data-[disabled]/field:opacity-50 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 *:data-[slot=field]:p-2.5 group/field-label peer/field-label flex w-fit has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col";

export const fieldTitleClass =
  "gap-2 text-sm font-medium group-data-[disabled]/field:opacity-50 flex w-fit items-center";

export const fieldDescriptionClass =
  "text-muted-foreground text-left text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-data-horizontal/field:text-balance last:mt-0 nth-last-2:-mt-1 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary";

export const fieldSeparatorClass =
  "-my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2 relative";

export const fieldSeparatorLineClass = "absolute inset-0 top-1/2";

export const fieldSeparatorContentClass =
  "text-muted-foreground px-2 relative mx-auto block w-fit bg-background";

export const fieldErrorClass = "text-destructive text-sm font-normal";

type StyleConfig = Readonly<{ className?: string }>;

/** Outermost fieldset wrapper. */
export const fieldSet = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.fieldset
    .attr("data-slot", "field-set")
    .class(cn(fieldsetClass, config.className))
    .children(children);

/** Legend naming the fieldset. `variant` toggles legend vs label sizing. */
export const fieldLegend = <M>(
  config: StyleConfig & Readonly<{ variant?: "legend" | "label" }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  h.legend
    .attr("data-slot", "field-legend")
    .attr("data-variant", config.variant ?? "legend")
    .class(cn(fieldsetLegendClass, config.className))
    .children(children);

/** Groups a set of fields; provides the container context the responsive
 *  field orientation reacts to. */
export const fieldGroup = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attr("data-slot", "field-group")
    .class(cn(fieldGroupClass, config.className))
    .children(children);

/** A single field row: label + content + description + error. */
export const field = <M>(
  config: StyleConfig & Readonly<{ orientation?: FieldOrientation; isInvalid?: boolean }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui => {
  const orientation = config.orientation ?? "vertical";
  return h.div
    .attr("role", "group")
    .attr("data-slot", "field")
    .attr("data-orientation", orientation)
    .attr("data-invalid", config.isInvalid === true ? "" : undefined)
    .class(cn(fieldBaseClass, fieldOrientationClasses[orientation], config.className))
    .children(children);
};

/** Content column of a field (the control plus its description/error). */
export const fieldContent = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attr("data-slot", "field-content")
    .class(cn(fieldContentClass, config.className))
    .children(children);

/** Standalone label (drop-in for `label.tsx`'s `Label`). */
export const label = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.label.attr("data-slot", "label").class(cn(labelClass, config.className)).children(children);

/** Label for a field; optionally associates with its control via `for`. */
export const fieldLabel = <M>(
  config: StyleConfig & Readonly<{ for?: string }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  h.label
    .attr("for", config.for)
    .attr("data-slot", "field-label")
    .class(cn(labelClass, fieldLabelClass, config.className))
    .children(children);

/** Non-interactive title for a field group. */
export const fieldTitle = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attr("data-slot", "field-label")
    .class(cn(fieldTitleClass, config.className))
    .children(children);

/** Field description / helper text. */
export const fieldDescription = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  h.p
    .attr("data-slot", "field-description")
    .class(cn(fieldDescriptionClass, config.className))
    .children(children);

/** Divider between fields, with optional centered content. */
export const fieldSeparator = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui => {
  const hasContent = children.length > 0;
  return h.div
    .attr("data-slot", "field-separator")
    .attr("data-content", hasContent ? "" : undefined)
    .class(cn(fieldSeparatorClass, config.className))
    .children(
      h.div
        .attr("role", "separator")
        .attr("data-horizontal", "")
        .class(cn(separatorClass, fieldSeparatorLineClass)),
      hasContent
        ? [
            h.span
              .attr("data-slot", "field-separator-content")
              .class(cn(fieldSeparatorContentClass))
              .children(children),
          ]
        : [],
    );
};

/** Field error, alerting for explicit children or a list of unique error
 *  messages. Returns `null` when there is no content. */
export const fieldError = <M>(
  config: StyleConfig &
    Readonly<{
      children?: ReadonlyArray<Child>;
      errors?: ReadonlyArray<{ message?: string } | undefined>;
    }>,
  h: H<M>,
): Ui | null => {
  const hasChildren = config.children !== undefined && config.children.length > 0;
  const uniqueErrors =
    config.errors === undefined
      ? []
      : Array.filter(
          [...new Map(Array.map(config.errors, (error) => [error?.message, error])).values()],
          (error) => error?.message !== undefined,
        );

  let content: ReadonlyArray<Child> | undefined;
  if (hasChildren) {
    content = config.children;
  } else if (uniqueErrors.length === 1) {
    content = [uniqueErrors[0]!.message!];
  } else if (uniqueErrors.length > 1) {
    content = [
      h.ul
        .class("ml-4 flex list-disc flex-col gap-1")
        .children(Array.map(uniqueErrors, (error) => h.li.children(error!.message!))),
    ];
  }

  if (content === undefined) {
    return null;
  }

  return h.div
    .attr("role", "alert")
    .attr("data-slot", "field-error")
    .class(cn(fieldErrorClass, config.className))
    .children(content);
};

export type FieldsetConfig = Readonly<{
  id: string;
  legend: string;
  description?: string;
  isDisabled?: boolean;
  className?: string;
  legendClass?: string;
  descriptionClass?: string;
  contentClass?: string;
  children: ReadonlyArray<Child>;
}>;

/** Styled fieldset with legend, optional description and grouped fields:
 *  native fieldset/legend semantics plus id / aria-describedby / disabled
 *  wiring. `data-disabled` drives the label classes' `group/field-set`
 *  variants. */
export const fieldset = <M>(config: FieldsetConfig, h: H<M>): Ui => {
  const isDisabled = config.isDisabled === true;
  const descriptionId = `${config.id}-description`;
  return h.fieldset
    .id(config.id)
    .attrs({
      "aria-describedby": config.description === undefined ? undefined : descriptionId,
      "data-disabled": isDisabled ? "" : undefined,
      "data-slot": "field-set",
    })
    .disabled(isDisabled)
    .class(cn(fieldsetClass, config.className))
    .children(
      h.legend
        .id(`${config.id}-legend`)
        .attr("data-slot", "field-legend")
        .attr("data-variant", "legend")
        .class(cn(fieldsetLegendClass, config.legendClass))
        .children(config.legend),
      config.description === undefined
        ? null
        : h.p
            .id(descriptionId)
            .attr("data-slot", "field-description")
            .class(cn(fieldDescriptionClass, config.descriptionClass))
            .children(config.description),
      h.div
        .attr("data-slot", "field-group")
        .class(cn(fieldGroupClass, config.contentClass))
        .children(config.children),
    );
};
