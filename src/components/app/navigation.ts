import type { H, Ui } from "@/lib/view";
import type { IconNode } from "lucide";
import { Array } from "effect";

import { RouteSchema, hrefFor, type Route } from "../../web/routes";
import { cn } from "@/lib/utils";
import { Clock, FileText, Play, Settings2, icon } from "./icons";

// ── Tabs ──────────────────────────────────────────────────────────────────

export type TabTag = "StartTab" | "HistoryTab" | "TemplatesTab" | "SettingsTab";

export type TabDef = Readonly<{
  tag: TabTag;
  label: string;
  icon: IconNode;
}>;

/** Always the same four tabs, so nothing shifts once the first session is
 *  saved; History shows its own empty state until then. Session leads: it is
 *  the landing page and the task people open Optio for. */
export const navigationTabs: ReadonlyArray<TabDef> = [
  { tag: "StartTab", label: "Session", icon: Play },
  { tag: "TemplatesTab", label: "Templates", icon: FileText },
  { tag: "HistoryTab", label: "History", icon: Clock },
  { tag: "SettingsTab", label: "Settings", icon: Settings2 },
];

/** The tab a route belongs to, so detail routes keep their parent highlighted. */
const activeTab = (route: Route): TabTag =>
  RouteSchema.match(route, {
    TemplatesTab: () => "TemplatesTab" as const,
    TemplateEditor: () => "TemplatesTab" as const,
    HistoryTab: () => "HistoryTab" as const,
    SessionDetail: () => "HistoryTab" as const,
    SettingsTab: () => "SettingsTab" as const,
    AgentHelp: () => "SettingsTab" as const,
    About: () => "SettingsTab" as const,
    StartTab: () => "StartTab" as const,
    SessionRunner: () => "StartTab" as const,
  });

// ── Phone: bottom tab bar ─────────────────────────────────────────────────

/**
 * iOS 26-style tab bar: a floating capsule inset from the screen edges, whose
 * current tab sits in its own inner capsule (icon over label). Anchors drive
 * hash routing. Hidden at md+ where the sidebar takes over, and on full-screen
 * routes (the live session). No glass refraction: a translucent surface only.
 */
export const tabBar = <M>(route: Route, h: H<M>): Ui => {
  const tabs = navigationTabs;
  const current = activeTab(route);
  return h.nav
    .class(
      "md:hidden pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] select-none",
    )
    .attr("aria-label", "Tabs")
    .attr("data-slot", "tab-bar")
    .children(
      h.div
        .class(
          "pointer-events-auto mx-auto flex h-16 max-w-md items-stretch gap-1 rounded-full border border-border/70 bg-card/85 p-1 shadow-lg shadow-black/10 backdrop-blur-xl",
        )
        .attr("data-slot", "tab-bar-capsule")
        .children(
          Array.map(tabs, (tab) => {
            const active = current === tab.tag;
            return h.a
              .class(
                cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:scale-[0.97] motion-reduce:active:scale-100",
                  // The inner capsule marks the current tab beyond colour alone.
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                ),
              )
              .attr("href", hrefFor({ _tag: tab.tag }))
              .attr("aria-label", tab.label)
              .attr("aria-current", active ? "page" : undefined)
              .children(
                icon(h, tab.icon, "size-6 shrink-0"),
                h.span
                  .class(
                    cn("text-[0.625rem] leading-none", active ? "font-semibold" : "font-medium"),
                  )
                  .children(tab.label),
              );
          }),
        ),
    );
};

// ── Tablet / desktop: sidebar ─────────────────────────────────────────────

/**
 * Persistent sidebar (SwiftUI NavigationSplitView). A compact icon rail on
 * tablets, a labeled column on wide screens. Same links, same order as the
 * tab bar, so nothing moves when the device rotates or the window grows.
 */
export const sidebar = <M>(route: Route, h: H<M>): Ui => {
  const tabs = navigationTabs;
  const current = activeTab(route);
  return h.aside
    .class(
      "hidden md:flex fixed inset-y-0 left-0 z-30 w-[4.5rem] xl:w-60 flex-col border-r border-border/70 bg-sidebar px-2 xl:px-3 pt-safe",
    )
    .attr("data-slot", "sidebar")
    .children(
      h.a
        .class(
          "mt-4 mb-6 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/60 xl:mx-0 justify-center xl:justify-start",
        )
        .attr("href", hrefFor({ _tag: "StartTab" }))
        .children(
          h.span
            .class(
              "grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground text-xl font-semibold leading-none",
            )
            .attr("aria-hidden", String(true))
            .children("o"),
          h.span
            .class("sr-only xl:not-sr-only xl:block")
            .children(
              h.span
                .class("block text-base font-semibold tracking-tight")
                .children("optio", h.span.class("sr-only").children(" home")),
              h.span
                .class("block text-[0.6875rem] text-muted-foreground")
                .attr("aria-hidden", String(true))
                .children("Time & motion studies"),
            ),
        ),
      h.nav
        .class("flex flex-col gap-1")
        .attr("aria-label", "Sections")
        .children(
          Array.map(tabs, (tab) => {
            const active = current === tab.tag;
            return h.a
              .class(
                cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors justify-center xl:justify-start",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                ),
              )
              .attr("href", hrefFor({ _tag: tab.tag }))
              .attr("aria-label", tab.label)
              .attr("title", tab.label)
              .attr("aria-current", active ? "page" : undefined)
              .children(
                icon(h, tab.icon, "size-5 shrink-0"),
                h.span.class("hidden xl:inline").children(tab.label),
              );
          }),
        ),
      h.div.class("mt-auto mb-4 flex flex-col gap-1 border-t border-border/70 pt-2").children(
        h.a
          .class(
            "flex min-h-11 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring xl:justify-start",
          )
          .attr("href", "https://github.com/mariusom/optio")
          .attr("target", "_blank")
          .attr("rel", "noopener noreferrer")
          .attr("aria-label", "Optio on GitHub (opens in a new tab)")
          .attr("title", "Optio on GitHub")
          .children(
            h
              .el("svg")
              .attr("class", "size-5 shrink-0")
              .attr("viewBox", "0 0 16 16")
              .attr("fill", "currentColor")
              .attr("aria-hidden", String(true))
              .children(
                h
                  .el("path")
                  .attr(
                    "d",
                    "M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656",
                  ),
              ),
            h.span.class("hidden xl:inline").children("GitHub"),
          ),
        h.p
          .class("hidden xl:block px-2.5 text-xs leading-relaxed text-muted-foreground")
          .children("Studies stored in this browser."),
      ),
    );
};
