import type { Html, HtmlBuilder } from "foldkit/html";
import type { IconNode } from "lucide";

import { hrefFor, type Route } from "../../we/routes";
import { cn } from "@/lib/utils";
import { Clock, FileText, Play, Settings2, icon } from "./icons";

// ── Tabs ──────────────────────────────────────────────────────────────────

export type TabTag = "StartTab" | "HistoryTab" | "TemplatesTab" | "SettingsTab";

export type TabDef = Readonly<{
  tag: TabTag;
  label: string;
  icon: IconNode;
}>;

const TABS: ReadonlyArray<TabDef> = [
  { tag: "TemplatesTab", label: "Templates", icon: FileText },
  { tag: "StartTab", label: "Session", icon: Play },
  { tag: "HistoryTab", label: "History", icon: Clock },
  { tag: "SettingsTab", label: "Settings", icon: Settings2 },
];

/** History only appears once there is something to look back on. */
export const navigationTabs = (hasHistory: boolean): ReadonlyArray<TabDef> =>
  hasHistory ? TABS : TABS.filter((tab) => tab.tag !== "HistoryTab");

/** The tab a route belongs to, so detail routes keep their parent highlighted. */
export const activeTab = (route: Route): TabTag => {
  switch (route._tag) {
    case "TemplatesTab":
    case "TemplateEditor":
      return "TemplatesTab";
    case "HistoryTab":
    case "SessionDetail":
      return "HistoryTab";
    case "SettingsTab":
      return "SettingsTab";
    case "StartTab":
    case "SessionRunner":
      return "StartTab";
  }
};

// ── Phone: bottom tab bar ─────────────────────────────────────────────────

/**
 * iOS-style tab bar. Anchors drive hash routing. Hidden at md+ where the
 * sidebar takes over, and on full-screen routes (the live session).
 */
export const tabBar = <M>(route: Route, hasHistory: boolean, h: HtmlBuilder<M>): Html => {
  const tabs = navigationTabs(hasHistory);
  const current = activeTab(route);
  return h.nav(
    [
      h.Class(
        "md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 pb-safe backdrop-blur-xl select-none",
      ),
      h.AriaLabel("Tabs"),
      h.DataAttribute("slot", "tab-bar"),
    ],
    [
      h.div(
        [h.Class("mx-auto flex h-[3.25rem] max-w-md items-stretch px-2")],
        tabs.map((tab) => {
          const active = current === tab.tag;
          return h.a(
            [
              h.Class(
                cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg transition-colors duration-150 active:opacity-60",
                  active ? "text-primary" : "text-muted-foreground",
                ),
              ),
              h.Href(hrefFor({ _tag: tab.tag })),
              h.AriaLabel(tab.label),
              ...(active ? [h.AriaCurrent("page")] : []),
            ],
            [
              icon(h, tab.icon, cn("size-6 shrink-0", active ? "fill-primary/15" : "")),
              h.span([h.Class("text-[0.625rem] font-medium leading-none")], [tab.label]),
            ],
          );
        }),
      ),
    ],
  );
};

// ── Tablet / desktop: sidebar ─────────────────────────────────────────────

/**
 * Persistent sidebar (SwiftUI NavigationSplitView). A compact icon rail on
 * tablets, a labeled column on wide screens. Same links, same order as the
 * tab bar, so nothing moves when the device rotates or the window grows.
 */
export const sidebar = <M>(route: Route, hasHistory: boolean, h: HtmlBuilder<M>): Html => {
  const tabs = navigationTabs(hasHistory);
  const current = activeTab(route);
  return h.aside(
    [
      h.Class(
        "hidden md:flex fixed inset-y-0 left-0 z-30 w-[4.5rem] xl:w-60 flex-col border-r border-border/70 bg-sidebar px-2 xl:px-3 pt-safe",
      ),
      h.DataAttribute("slot", "sidebar"),
    ],
    [
      h.a(
        [
          h.Class(
            "mt-4 mb-6 flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/60 xl:mx-0 justify-center xl:justify-start",
          ),
          h.Href(hrefFor({ _tag: "StartTab" })),
          h.AriaLabel("Optio home"),
        ],
        [
          h.span(
            [
              h.Class(
                "grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground text-xl font-semibold leading-none",
              ),
              h.AriaHidden(true),
            ],
            ["o"],
          ),
          h.span(
            [h.Class("hidden xl:block")],
            [
              h.span([h.Class("block text-base font-semibold tracking-tight")], ["optio"]),
              h.span(
                [h.Class("block text-[0.6875rem] text-muted-foreground")],
                ["Time & motion studies"],
              ),
            ],
          ),
        ],
      ),
      h.nav(
        [h.Class("flex flex-col gap-1"), h.AriaLabel("Sections")],
        tabs.map((tab) => {
          const active = current === tab.tag;
          return h.a(
            [
              h.Class(
                cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors justify-center xl:justify-start",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                ),
              ),
              h.Href(hrefFor({ _tag: tab.tag })),
              h.AriaLabel(tab.label),
              h.Title(tab.label),
              ...(active ? [h.AriaCurrent("page")] : []),
            ],
            [
              icon(h, tab.icon, "size-5 shrink-0"),
              h.span([h.Class("hidden xl:inline")], [tab.label]),
            ],
          );
        }),
      ),
      h.div(
        [h.Class("mt-auto mb-4 flex flex-col gap-3 border-t border-border/70 pt-3")],
        [
          h.a(
            [
              h.Class(
                "flex min-h-11 items-center justify-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-ring xl:justify-start",
              ),
              h.Href("https://github.com/mariusom/optio"),
              h.Target("_blank"),
              h.Rel("noopener noreferrer"),
              h.AriaLabel("Optio on GitHub (opens in a new tab)"),
              h.Title("Optio on GitHub"),
            ],
            [
              // GitHub's mark-github-16 from primer/octicons (MIT).
              h.svg(
                [
                  h.Class("size-5 shrink-0"),
                  h.ViewBox("0 0 16 16"),
                  h.Fill("currentColor"),
                  h.AriaHidden(true),
                ],
                [
                  h.path([
                    h.D(
                      "M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656",
                    ),
                  ]),
                ],
              ),
              h.span([h.Class("hidden xl:inline")], ["GitHub"]),
            ],
          ),
          h.p(
            [h.Class("hidden xl:block text-xs leading-relaxed text-muted-foreground")],
            ["Everything stays on this device."],
          ),
        ],
      ),
    ],
  );
};
