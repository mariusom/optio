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
      h.p(
        [
          h.Class(
            "mt-auto mb-4 hidden xl:block border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground",
          ),
        ],
        ["Everything stays on this device."],
      ),
    ],
  );
};
