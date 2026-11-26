import type { H, Ui } from "@/lib/view";

import { button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, icon } from "./icons";
import { contentWidth } from "./layout";

type Child = Ui | string;

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
  leading?: Ui;
  /** Trailing controls: at most two compact buttons. */
  trailing?: ReadonlyArray<Ui>;
  /** Muted context beside the title, wrapping underneath when space is limited. */
  subtitle?: Ui | string;
  wide?: boolean;
  className?: string;
}>;

/**
 * Navigation bar for pushed screens (SwiftUI `.navigationBarTitleDisplayMode(.inline)`):
 * 44pt tall, title centered, back on the left, actions on the right. The same
 * bar is used on phone, tablet and desktop, so nothing rearranges between
 * breakpoints.
 */
export const navBar = <M>(config: NavBarConfig<M>, h: H<M>): Ui =>
  h.header
    .class(
      cn(
        "sticky top-0 z-20 shrink-0 border-b border-border/70 bg-background pt-safe select-none",
        config.className,
      ),
    )
    .attr("data-slot", "nav-bar")
    .children(
      h.div
        .class(
          cn(
            "mx-auto grid min-h-11 w-full grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center px-safe py-1",
            config.wide === true ? "max-w-5xl" : "max-w-3xl",
          ),
        )
        .children(
          h.div
            .class("flex min-w-0 items-center justify-start")
            .children(
              config.back !== undefined
                ? [backButton(config.back, h)]
                : config.leading !== undefined && config.leading !== null
                  ? [config.leading]
                  : [],
            ),
          h.div
            .class(
              "flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-1 text-center",
            )
            .children(
              h.h1
                .class(
                  "min-w-0 max-w-full truncate text-base font-semibold tracking-tight focus-visible:outline-none",
                )
                .attr("dir", "auto")
                .children(config.title),
              config.subtitle === undefined
                ? []
                : [
                    h.span
                      .class(
                        "min-w-0 max-w-full rounded-md bg-muted px-2 py-0.5 text-xs break-words text-muted-foreground",
                      )
                      .children(config.subtitle),
                  ],
            ),
          h.div
            .class("flex min-w-0 items-center justify-end gap-1")
            .children(config.trailing ?? []),
        ),
    );

const backClass = buttonClass({
  variant: "ghost",
  className: "-ml-2 min-w-11 max-w-56 justify-start gap-1 px-2 text-base text-primary",
});

const backButton = <M>(back: BackLink<M>, h: H<M>): Ui => {
  const body = [
    icon(h, ChevronLeft, "size-6 shrink-0 -ml-0.5"),
    h.span.class("hidden truncate sm:inline").children(back.label),
  ];
  const label = `Back to ${back.label}`;
  return back.onClick === undefined
    ? h.a.class(backClass).attr("href", back.href).attr("aria-label", label).children(body)
    : button(
        {
          variant: "ghost",
          className: "-ml-2 min-w-11 max-w-56 justify-start gap-1 px-2 text-base text-primary",
          onClick: back.onClick,
          attrs: { "aria-label": label },
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
    attrs?: Readonly<Record<string, string | undefined>>;
  }>,
  h: H<M>,
): Ui => {
  const className = cn(
    "px-2 text-base text-primary",
    config.emphasized === true && "font-semibold",
  );
  const attrs = {
    "aria-label":
      config.ariaLabel !== undefined && config.ariaLabel !== "" ? config.ariaLabel : undefined,
    ...config.attrs,
  };
  if (config.href !== undefined) {
    return h.a
      .class(buttonClass({ variant: "ghost", className }))
      .attr("href", config.href)
      .attrs(attrs)
      .children(config.label);
  }
  return button(
    {
      type: "button",
      variant: "ghost",
      className,
      isDisabled: config.isDisabled,
      onClick: config.onClick,
      attrs,
    },
    config.label,
    h,
  );
};

export type PageHeaderConfig = Readonly<{
  title: string;
  subtitle?: Child;
  /** One trailing control, usually an icon button or short text button. */
  trailing?: Ui;
  /** Match a page that widens (`page({ wide })`). */
  wide?: boolean | "xl";
}>;

/**
 * Pinned title and action row for tab roots, sharing the content column.
 */
export const pageHeader = <M>(config: PageHeaderConfig, h: H<M>): Ui =>
  h.div
    .class("sticky top-0 z-20 border-b border-border/70 bg-background pt-safe")
    .attr("data-slot", "page-header")
    .children(
      h.div
        .class(
          cn(
            "mx-auto flex min-h-[4.25rem] w-full items-center justify-between gap-4 px-safe py-3 md:min-h-[5.25rem] md:py-5",
            contentWidth(config.wide),
          ),
        )
        .children(
          h.div
            .class("min-w-0")
            .children(
              h.h1
                .class(
                  "truncate text-2xl font-semibold tracking-tight text-foreground focus-visible:outline-none md:text-3xl",
                )
                .attr("dir", "auto")
                .children(config.title),
              config.subtitle === undefined
                ? []
                : [h.p.class("mt-1 text-sm text-muted-foreground").children(config.subtitle)],
            ),
          config.trailing === undefined ? [] : [h.div.class("shrink-0").children(config.trailing)],
        ),
    );
