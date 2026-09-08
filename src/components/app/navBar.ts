import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";
import { ChevronLeft, icon } from "./icons";

type Child = Html | string;

export type BackLink<M = never> = Readonly<{
  href: string;
  label: string;
  /** When set, the control dispatches instead of navigating (e.g. to confirm discarding edits). */
  onClick?: M;
}>;

export type NavBarConfig<M> = Readonly<{
  title: string;
  /** Back affordance (chevron + parent name), shown on every device size. */
  back?: BackLink<M>;
  /** Leading control when there is no back link (e.g. Cancel). */
  leading?: Html;
  /** Trailing controls: at most two compact buttons. */
  trailing?: ReadonlyArray<Html>;
  /** Small caption under the title (e.g. live timer). */
  subtitle?: Html | string;
  className?: string;
}>;

/**
 * Navigation bar for pushed screens (SwiftUI `.navigationBarTitleDisplayMode(.inline)`):
 * 44pt tall, title centered, back on the left, actions on the right. The same
 * bar is used on phone, tablet and desktop, so nothing rearranges between
 * breakpoints.
 */
export const navBar = <M>(config: NavBarConfig<M>, h: HtmlBuilder<M>): Html =>
  h.header(
    [
      h.Class(
        cn(
          "sticky top-0 z-20 shrink-0 border-b border-border/70 bg-background/85 pt-safe backdrop-blur-xl select-none",
          config.className,
        ),
      ),
      h.DataAttribute("slot", "nav-bar"),
    ],
    [
      h.div(
        [
          h.Class(
            "mx-auto grid h-11 w-full max-w-3xl grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center px-safe",
          ),
        ],
        [
          h.div(
            [h.Class("flex min-w-0 items-center justify-start")],
            config.back !== undefined
              ? [backButton(config.back, h)]
              : config.leading
                ? [config.leading]
                : [],
          ),
          h.h1(
            [
              h.Class(
                "min-w-0 truncate px-1 text-center text-[1.0625rem] font-semibold tracking-tight",
              ),
            ],
            [config.title],
          ),
          h.div([h.Class("flex min-w-0 items-center justify-end gap-1")], config.trailing ?? []),
        ],
      ),
      ...(config.subtitle === undefined
        ? []
        : [
            h.div(
              [
                h.Class(
                  "mx-auto flex w-full max-w-3xl justify-center px-safe pb-1.5 text-xs text-muted-foreground",
                ),
              ],
              [config.subtitle],
            ),
          ]),
    ],
  );

const backClass =
  "-ml-2 inline-flex h-11 max-w-[9rem] items-center gap-0.5 rounded-lg pr-2 pl-1 text-[1.0625rem] text-primary active:opacity-60";

const backButton = <M>(back: BackLink<M>, h: HtmlBuilder<M>): Html => {
  const body = [
    icon(h, ChevronLeft, "size-6 shrink-0 -ml-0.5"),
    h.span([h.Class("truncate")], [back.label]),
  ];
  const label = h.AriaLabel(`Back to ${back.label}`);
  return back.onClick === undefined
    ? h.a([h.Class(backClass), h.Href(back.href), label], body)
    : h.button([h.Type("button"), h.Class(backClass), h.OnClick(back.onClick), label], body);
};

/** Compact text button for nav bar trailing slots ("Done", "Save", "Edit"). */
export const navBarAction = <M>(
  config: Readonly<{
    label: Child;
    onClick?: M;
    href?: string;
    isDisabled?: boolean;
    emphasized?: boolean;
    ariaLabel?: string;
    /** Extra attributes (aria-expanded, aria-controls, ids). */
    attributes?: ReadonlyArray<Attribute<M> | ChildAttribute>;
  }>,
  h: HtmlBuilder<M>,
): Html => {
  const classes = cn(
    "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-[1.0625rem] text-primary active:opacity-60 disabled:opacity-40 disabled:pointer-events-none",
    config.emphasized ? "font-semibold" : "",
  );
  if (config.href !== undefined) {
    return h.a(
      [
        h.Class(classes),
        h.Href(config.href),
        ...(config.ariaLabel ? [h.AriaLabel(config.ariaLabel)] : []),
      ],
      [config.label],
    );
  }
  return h.button(
    [
      h.Type("button"),
      h.Class(classes),
      h.Disabled(config.isDisabled ?? false),
      ...(config.onClick !== undefined ? [h.OnClick(config.onClick)] : []),
      ...(config.ariaLabel ? [h.AriaLabel(config.ariaLabel)] : []),
      ...(config.attributes ?? []),
    ],
    [config.label],
  );
};

export type PageHeaderConfig = Readonly<{
  title: string;
  subtitle?: Child;
  /** One trailing control, usually an icon button or short text button. */
  trailing?: Html;
}>;

/**
 * Large title for tab roots (SwiftUI `.navigationBarTitleDisplayMode(.large)`).
 * Lives inside the scrolling content, so the top of the screen is clean.
 */
export const pageHeader = <M>(config: PageHeaderConfig, h: HtmlBuilder<M>): Html =>
  h.div(
    [h.Class("pt-safe"), h.DataAttribute("slot", "page-header")],
    [
      h.div(
        [
          h.Class(
            "mx-auto flex w-full max-w-3xl items-end justify-between gap-4 px-safe pt-4 pb-3 md:pt-8",
          ),
        ],
        [
          h.div(
            [h.Class("min-w-0")],
            [
              h.h1([h.Class("text-large-title truncate text-foreground")], [config.title]),
              ...(config.subtitle === undefined
                ? []
                : [h.p([h.Class("mt-1 text-sm text-muted-foreground")], [config.subtitle])]),
            ],
          ),
          ...(config.trailing === undefined
            ? []
            : [h.div([h.Class("shrink-0 pb-0.5")], [config.trailing])]),
        ],
      ),
    ],
  );
