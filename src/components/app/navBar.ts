import type { Attribute, ChildAttribute, Html, HtmlBuilder } from "foldkit/html";

import { button, buttonClass } from "@/components/ui/button";
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
  /** Back chevron; parent name is also visible on larger screens. */
  back?: BackLink<M>;
  /** Leading control when there is no back link (e.g. Cancel). */
  leading?: Html;
  /** Trailing controls: at most two compact buttons. */
  trailing?: ReadonlyArray<Html>;
  /** Small caption under the title (e.g. live timer). */
  subtitle?: Html | string;
  wide?: boolean;
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
          "sticky top-0 z-20 shrink-0 border-b border-border/70 bg-background pt-safe select-none",
          config.className,
        ),
      ),
      h.DataAttribute("slot", "nav-bar"),
    ],
    [
      h.div(
        [
          h.Class(
            cn(
              "mx-auto grid h-11 w-full grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center px-safe",
              config.wide ? "max-w-5xl" : "max-w-3xl",
            ),
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
            [h.Class("min-w-0 truncate px-1 text-center text-base font-semibold tracking-tight")],
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

const backClass = buttonClass({
  variant: "ghost",
  className: "-ml-2 min-w-11 max-w-36 justify-start gap-1 px-2 text-base text-primary",
});

const backButton = <M>(back: BackLink<M>, h: HtmlBuilder<M>): Html => {
  const body = [
    icon(h, ChevronLeft, "size-6 shrink-0 -ml-0.5"),
    h.span([h.Class("hidden truncate sm:inline")], [back.label]),
  ];
  const label = h.AriaLabel(`Back to ${back.label}`);
  return back.onClick === undefined
    ? h.a([h.Class(backClass), h.Href(back.href), label], body)
    : button(
        {
          variant: "ghost",
          className: "-ml-2 min-w-11 max-w-36 justify-start gap-1 px-2 text-base text-primary",
          onClick: back.onClick,
          attributes: [label],
        },
        body,
        h,
      );
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
  const className = cn("px-2 text-base text-primary", config.emphasized && "font-semibold");
  const attributes = [
    ...(config.ariaLabel ? [h.AriaLabel(config.ariaLabel)] : []),
    ...(config.attributes ?? []),
  ];
  if (config.href !== undefined) {
    return h.a(
      [h.Class(buttonClass({ variant: "ghost", className })), h.Href(config.href), ...attributes],
      [config.label],
    );
  }
  return button(
    {
      type: "button",
      variant: "ghost",
      className,
      isDisabled: config.isDisabled,
      onClick: config.onClick,
      attributes: attributes as ReadonlyArray<Attribute<M>>,
    },
    config.label,
    h,
  );
};

export type PageHeaderConfig = Readonly<{
  title: string;
  subtitle?: Child;
  /** One trailing control, usually an icon button or short text button. */
  trailing?: Html;
}>;

/**
 * Pinned title and action row for tab roots, sharing the content column.
 */
export const pageHeader = <M>(config: PageHeaderConfig, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Class("sticky top-0 z-20 border-b border-border/70 bg-background pt-safe"),
      h.DataAttribute("slot", "page-header"),
    ],
    [
      h.div(
        [
          h.Class(
            "mx-auto flex min-h-[4.25rem] w-full max-w-3xl items-center justify-between gap-4 px-safe py-3 md:min-h-[5.25rem] md:py-5",
          ),
        ],
        [
          h.div(
            [h.Class("min-w-0")],
            [
              h.h1(
                [
                  h.Class(
                    "truncate text-2xl font-semibold tracking-tight text-foreground md:text-3xl",
                  ),
                ],
                [config.title],
              ),
              ...(config.subtitle === undefined
                ? []
                : [h.p([h.Class("mt-1 text-sm text-muted-foreground")], [config.subtitle])]),
            ],
          ),
          ...(config.trailing === undefined
            ? []
            : [h.div([h.Class("shrink-0")], [config.trailing])]),
        ],
      ),
    ],
  );
