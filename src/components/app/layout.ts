import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";
import { Option } from "effect";

import { Check, ChevronRight, icon } from "./icons";

type Child = Html | string;
type Attrs<M> = ReadonlyArray<Attribute<M> | ChildAttribute>;

/** Content column: centered, readable width, bottom padding clears the tab bar. */
export const page = <M>(
  config: Readonly<{ className?: string; wide?: boolean }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(
        cn(
          "mx-auto flex w-full flex-col gap-6 px-safe pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12",
          config.wide ? "max-w-5xl" : "max-w-3xl",
          config.className,
        ),
      ),
    ],
    children,
  );

/** Section heading above a grouped list (iOS section header). */
export const sectionHeader = <M>(text: Child, h: HtmlBuilder<M>, className?: string): Html =>
  h.h2(
    [
      h.Class(
        cn(
          "px-4 pb-1.5 text-[0.8125rem] font-medium uppercase tracking-wide text-muted-foreground",
          className,
        ),
      ),
    ],
    [text],
  );

/** Explanatory text under a grouped list (iOS section footer). */
export const sectionFooter = <M>(text: Child, h: HtmlBuilder<M>): Html =>
  h.p([h.Class("px-4 pt-1.5 text-[0.8125rem] leading-snug text-muted-foreground")], [text]);

/**
 * Inset grouped list (SwiftUI `List` with `.insetGrouped`). Children are rows;
 * hairlines are drawn between them automatically.
 */
export const groupedList = <M>(
  config: Readonly<{
    header?: Child;
    footer?: Child;
    className?: string;
    attributes?: Attrs<M>;
    /** Role and attributes for the list element itself (e.g. radiogroup + its name). */
    role?: string;
    listAttributes?: Attrs<M>;
  }>,
  rows: ReadonlyArray<Html>,
  h: HtmlBuilder<M>,
): Html =>
  h.section(
    [h.Class("flex flex-col"), ...(config.attributes ?? [])],
    [
      ...(config.header === undefined ? [] : [sectionHeader(config.header, h)]),
      h.div(
        [
          h.Class(
            cn(
              "overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 divide-y divide-border/80",
              config.className,
            ),
          ),
          ...(config.role !== undefined ? [h.Role(config.role)] : []),
          ...(config.listAttributes ?? []),
          h.DataAttribute("slot", "grouped-list"),
        ],
        rows,
      ),
      ...(config.footer === undefined ? [] : [sectionFooter(config.footer, h)]),
    ],
  );

export type RowConfig<M> = Readonly<{
  title: Child;
  subtitle?: Child;
  /** Trailing value text (iOS "detail" label). */
  value?: Child;
  leading?: Html;
  trailing?: Html;
  /** Navigation affordance. */
  href?: string;
  onClick?: M;
  chevron?: boolean;
  destructive?: boolean;
  isDisabled?: boolean;
  className?: string;
  attributes?: Attrs<M>;
  /** Lazy rows skip paint when off-screen; use for long lists. */
  lazy?: boolean;
  /** Stack the value under the title and let both wrap (long answers). */
  wrap?: boolean;
}>;

/**
 * A row in a grouped list: 44pt minimum, whole row tappable when it navigates.
 */
export const row = <M>(config: RowConfig<M>, h: HtmlBuilder<M>): Html => {
  const interactive = config.href !== undefined || config.onClick !== undefined;
  const chevron = config.chevron ?? config.href !== undefined;
  const classes = cn(
    "flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left text-[1.0625rem] leading-snug",
    config.wrap ? "flex-wrap gap-y-1" : "",
    interactive ? "transition-colors hover:bg-muted/60 active:bg-muted disabled:opacity-50" : "",
    config.destructive ? "text-destructive" : "text-foreground",
    config.lazy ? "lazy-row" : "",
    config.className,
  );
  const body: Array<Child> = [
    ...(config.leading === undefined
      ? []
      : [h.span([h.Class("shrink-0 text-muted-foreground")], [config.leading])]),
    h.span(
      [h.Class("flex min-w-0 flex-1 flex-col")],
      [
        h.span([h.Class("truncate")], [config.title]),
        ...(config.subtitle === undefined
          ? []
          : [
              h.span(
                [h.Class("truncate text-[0.9375rem] text-muted-foreground")],
                [config.subtitle],
              ),
            ]),
      ],
    ),
    ...(config.value === undefined
      ? []
      : [
          h.span(
            [
              h.Class(
                config.wrap
                  ? "basis-full whitespace-pre-wrap break-words text-muted-foreground"
                  : "shrink-0 max-w-[55%] truncate text-right text-muted-foreground tabular",
              ),
            ],
            [config.value],
          ),
        ]),
    ...(config.trailing === undefined ? [] : [h.span([h.Class("shrink-0")], [config.trailing])]),
    ...(chevron ? [icon(h, ChevronRight, "size-5 shrink-0 text-muted-foreground/60 -mr-1")] : []),
  ];
  const extra = config.attributes ?? [];
  if (config.href !== undefined) {
    return h.a([h.Class(classes), h.Href(config.href), ...extra], body);
  }
  if (config.onClick !== undefined) {
    return h.button(
      [
        h.Type("button"),
        h.Class(classes),
        h.Disabled(config.isDisabled ?? false),
        h.OnClick(config.onClick),
        ...extra,
      ],
      body,
    );
  }
  return h.div([h.Class(classes), ...extra], body);
};

/** Free-form row that hosts a form control (input, textarea, switch). */
export const controlRow = <M>(
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
  className?: string,
): Html => h.div([h.Class(cn("flex flex-col gap-1.5 px-4 py-3", className))], children);

/** Chip-style status label. */
export const statusPill = <M>(
  config: Readonly<{
    tone?: "neutral" | "primary" | "success" | "warning" | "destructive";
    className?: string;
  }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => {
  const tone = config.tone ?? "neutral";
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/12 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/25 text-warning-content",
    destructive: "bg-destructive/12 text-destructive",
  } as const;
  return h.span(
    [
      h.Class(
        cn(
          "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
          tones[tone],
          config.className,
        ),
      ),
    ],
    children,
  );
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
  h: HtmlBuilder<M>,
): Html => {
  const choices = config.choices;
  const selectedIndex = Math.max(
    0,
    choices.findIndex((choice) => choice.selected),
  );
  const at = (index: number) => choices[(index + choices.length) % choices.length];
  return groupedList(
    {
      header: config.header,
      footer: config.footer,
      role: "radiogroup",
      listAttributes: [h.AriaLabel(config.label)],
    },
    choices.map((choice, index) =>
      row(
        {
          title: choice.label,
          subtitle: choice.subtitle,
          onClick: choice.onSelect,
          trailing: choice.selected
            ? icon(h, Check, "size-5 text-primary")
            : h.span([h.Class("size-5")], []),
          attributes: [
            h.Role("radio"),
            h.AriaChecked(choice.selected),
            h.Tabindex(index === selectedIndex ? 0 : -1),
            h.OnKeyDownPreventDefault((key) => {
              switch (key) {
                case "ArrowDown":
                case "ArrowRight":
                  return Option.some(at(index + 1).onSelect);
                case "ArrowUp":
                case "ArrowLeft":
                  return Option.some(at(index - 1).onSelect);
                case "Home":
                  return Option.some(at(0).onSelect);
                case "End":
                  return Option.some(at(choices.length - 1).onSelect);
                default:
                  return Option.none();
              }
            }),
          ],
        },
        h,
      ),
    ),
    h,
  );
};
