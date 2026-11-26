import type { Html } from "@effect/ui/html";
import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";
import { Array, Option } from "effect";
import { badge } from "@/components/ui/badge";
import { button, type ButtonConfig, type ButtonLabel } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { itemClass, itemSizes, itemTitleClass, itemDescriptionClass } from "@/components/ui/item";

import { Check, ChevronRight, icon } from "./icons";

type Child = Ui | string;
/** Any HTML element builder whose events include `keydown`. */
type Element<M> = Html.Element<M, never, Html.Events, any, any>;
type Attrs = Readonly<Record<string, string | undefined>>;

/** Edge-to-edge action cell beside a grouped-list row. */
export const rowAction = <M>(
  config: Pick<ButtonConfig<M>, "onClick" | "isDisabled" | "attrs" | "className">,
  label: ButtonLabel,
  h: H<M>,
): Ui =>
  button(
    {
      ...config,
      variant: "ghost",
      size: "icon",
      className: cn(
        "h-auto min-h-11 w-11 self-stretch rounded-none border-0 bg-clip-border focus-visible:-outline-offset-3 focus-visible:outline-2 focus-visible:outline-ring active:translate-y-0",
        config.className,
      ),
    },
    label,
    h,
  );

/** Content column width; `"xl"` widens it only on wide desktops. */
export const contentWidth = (wide: boolean | "xl" | undefined): string =>
  wide === "xl" ? "max-w-3xl xl:max-w-5xl" : wide === true ? "max-w-5xl" : "max-w-3xl";

/** Content column: centered, readable width, bottom padding clears the tab bar. */
export const page = <M>(
  config: Readonly<{ className?: string; wide?: boolean | "xl" }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  h.div
    .class(
      cn(
        "mx-auto flex w-full flex-col gap-6 px-safe pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-12",
        contentWidth(config.wide),
        config.className,
      ),
    )
    .attr("data-slot", "page")
    .children(children);

/** Section heading above a grouped list (iOS section header). */
export const sectionHeader = <M>(text: Child, h: H<M>, className?: string): Ui =>
  h.h2
    .class(cn("pb-2 text-sm font-medium text-foreground", className))
    .attr("data-slot", "section-header")
    .children(text);

/** Explanatory text under a grouped list (iOS section footer). */
export const sectionFooter = <M>(text: Child, h: H<M>): Ui =>
  h.p.class("pt-2 text-sm leading-relaxed text-muted-foreground").children(text);

/**
 * Inset grouped list (SwiftUI `List` with `.insetGrouped`). Children are rows;
 * hairlines are drawn between them automatically.
 */
export const groupedList = <M>(
  config: Readonly<{
    header?: Child;
    footer?: Child;
    /** Plain groups arrange controls without painting a Card surface. */
    surface?: "card" | "plain";
    className?: string;
    attrs?: Attrs;
    /** Role and attributes for the list element itself (e.g. radiogroup + its name). */
    role?: string;
    listAttrs?: Attrs;
  }>,
  rows: ReadonlyArray<Ui>,
  h: H<M>,
): Ui =>
  h.section
    .class("flex flex-col")
    .attrs(config.attrs ?? {})
    .children(
      config.header === undefined ? [] : [sectionHeader(config.header, h)],
      h.div
        .class(
          cn(
            config.surface === "plain" ? "flex flex-col" : cardClass,
            "gap-0 py-0 divide-y divide-border",
            config.className,
          ),
        )
        .attr("role", config.role)
        .attrs(config.listAttrs ?? {})
        .attr("data-slot", "grouped-list")
        .attr("data-surface", config.surface ?? "card")
        .children(rows),
      config.footer === undefined ? [] : [sectionFooter(config.footer, h)],
    );

export type RowConfig<M> = Readonly<{
  title: Child;
  subtitle?: Child;
  /** Trailing value text (iOS "detail" label). */
  value?: Child;
  leading?: Ui;
  trailing?: Ui;
  /** Navigation affordance. */
  href?: string;
  onClick?: M;
  chevron?: boolean;
  destructive?: boolean;
  isDisabled?: boolean;
  className?: string;
  attrs?: Attrs;
  /** Keyboard handler; a returned message also cancels the key's default. */
  onKeyDown?: (key: string) => M | undefined;
  /** Lazy rows skip paint when off-screen; use for long lists. */
  lazy?: boolean;
  /** Stack the value under the title and let both wrap (long answers). */
  wrap?: boolean;
  /** Stable identity for rows in lists that insert or reorder items. */
  key?: string;
}>;

const rowContent = <M>(config: RowConfig<M>, chevron: boolean, h: H<M>): Array<Child> => [
  ...(config.leading === undefined
    ? []
    : [h.span.class("shrink-0 text-muted-foreground").children(config.leading)]),
  h.span
    .class("flex min-w-0 flex-1 flex-col")
    .children(
      h.span
        .class(cn(itemTitleClass, "block max-w-full truncate"))
        .attr("dir", "auto")
        .children(config.title),
      config.subtitle === undefined
        ? []
        : [
            h.span
              .class(cn(itemDescriptionClass, "truncate"))
              .attr("dir", "auto")
              .children(config.subtitle),
          ],
    ),
  ...(config.value === undefined
    ? []
    : [
        h.span
          .class(
            config.wrap === true
              ? "basis-full whitespace-pre-wrap break-words text-muted-foreground"
              : "shrink-0 max-w-[55%] truncate text-right text-muted-foreground tabular",
          )
          .children(config.value),
      ]),
  ...(config.trailing === undefined ? [] : [h.span.class("shrink-0").children(config.trailing)]),
  ...(chevron ? [icon(h, ChevronRight, "size-5 shrink-0 text-muted-foreground/60 -mr-1")] : []),
];

/**
 * A row in a grouped list: 44pt minimum, whole row tappable when it navigates.
 */
export const row = <M>(config: RowConfig<M>, h: H<M>): Ui => {
  const interactive = config.href !== undefined || config.onClick !== undefined;
  const chevron = config.chevron ?? config.href !== undefined;
  const classes = cn(
    itemClass,
    itemSizes.default,
    "min-h-11 flex-nowrap rounded-none border-0 [[data-slot=grouped-list]>&:not(:last-child)]:border-b text-left aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground aria-checked:bg-accent aria-checked:text-accent-foreground",
    "focus-visible:border-border focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:-outline-offset-3",
    config.wrap === true ? "flex-wrap gap-y-1" : "",
    interactive ? "transition-colors hover:bg-muted/60 active:bg-muted disabled:opacity-50" : "",
    config.destructive === true ? "text-destructive" : "text-foreground",
    config.lazy === true ? "lazy-row" : "",
    config.className,
  );
  const body = rowContent(config, chevron, h);
  const extra = config.attrs ?? {};
  const { key, onKeyDown } = config;
  // Keyed rows keep their DOM node (and keyboard focus) when rows are inserted above.
  const finish = <B extends Element<M>>(builder: B): B => {
    const keyed = key === undefined ? builder : builder.key(key);
    return onKeyDown === undefined
      ? keyed
      : keyed.on("keydown", ({ key: pressed }) => onKeyDown(pressed), {
          preventDefault: true,
        });
  };
  if (config.href !== undefined) {
    return finish(h.a.class(classes).attr("href", config.href).attrs(extra)).children(body);
  }
  if (config.onClick !== undefined) {
    return finish(
      h.button
        .attr("type", "button")
        .class(classes)
        .disabled(config.isDisabled ?? false)
        .on("click", config.onClick)
        .attrs(extra),
    ).children(body);
  }
  return finish(h.div.class(classes).attrs(extra)).children(body);
};

/** Free-form row that hosts a form control (input, textarea, switch). */
// Returns the element, not `Ui`, so a row among keyed siblings can take a `.key`.
export const controlRow = <M>(children: ReadonlyArray<Child>, h: H<M>, className?: string) =>
  h.div.class(cn(itemSizes.default, "flex flex-col", className)).children(children);

/** Chip-style status label. */
export const statusPill = <M>(
  config: Readonly<{
    tone?: "neutral" | "primary" | "success" | "warning" | "destructive";
    className?: string;
  }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui => {
  const tone = config.tone ?? "neutral";
  const tones = {
    // Not muted-on-muted: that pair misses 4.5:1 in Classic light.
    neutral: "bg-muted text-foreground/75",
    primary: "bg-primary/12 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/25 text-warning-content",
    destructive: "bg-destructive/12 text-destructive",
  } as const;
  return badge({ variant: "secondary", className: cn(tones[tone], config.className) }, children, h);
};

export type Choice<M> = Readonly<{
  label: Child;
  selected: boolean;
  onSelect: M;
  subtitle?: Child;
}>;

/**
 * Single-selection list (SwiftUI Picker in a List): one checkmark, one tab
 * stop, arrow keys move the selection, Space/Enter re-select. Rows carry
 * role=radio inside a named radiogroup.
 */
export const choiceRows = <M>(
  config: Readonly<{
    label: string;
    header?: Child;
    footer?: Child;
    choices: ReadonlyArray<Choice<M>>;
  }>,
  h: H<M>,
): Ui => {
  const choices = config.choices;
  const selectedIndex = Option.getOrElse(
    Array.findFirstIndex(choices, (choice) => choice.selected),
    () => 0,
  );
  const at = (index: number) => choices[(index + choices.length) % choices.length];
  // One inset list like every other grouped setting; rows keep radio semantics.
  return groupedList(
    {
      header: config.header,
      footer: config.footer,
      role: "radiogroup",
      listAttrs: { "aria-label": config.label },
    },
    Array.map(choices, (choice, index) =>
      row(
        {
          title: choice.label,
          ...(choice.subtitle === undefined ? {} : { subtitle: choice.subtitle }),
          onClick: choice.onSelect,
          chevron: false,
          // Muted subtitles fall below 4.5:1 on the selected row's background.
          className: choice.selected
            ? "py-3 [&_.text-muted-foreground]:text-foreground/75"
            : "py-3",
          trailing: choice.selected
            ? icon(h, Check, "size-5 shrink-0 text-primary")
            : h.span.class("block size-5 shrink-0").attr("aria-hidden", String(true)),
          attrs: {
            role: "radio",
            "aria-checked": String(choice.selected),
            tabindex: index === selectedIndex ? "0" : "-1",
          },
          onKeyDown: (key) => {
            switch (key) {
              case "ArrowDown":
              case "ArrowRight":
                return at(index + 1).onSelect;
              case "ArrowUp":
              case "ArrowLeft":
                return at(index - 1).onSelect;
              case "Home":
                return at(0).onSelect;
              case "End":
                return at(choices.length - 1).onSelect;
              default:
                return undefined;
            }
          },
        },
        h,
      ),
    ),
    h,
  );
};
