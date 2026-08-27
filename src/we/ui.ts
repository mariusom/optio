import type { Html, HtmlBuilder } from "foldkit/html";

import { hrefFor, isFullScreenRoute, type Route } from "./routes";

// Shared view primitives for the optio shell.
// Plain functions per foldkit docs (only h.submodel-embedded views need defineView).

// ── Icons ────────────────────────────────────────────────────────────────

type IconProps = { readonly name: IconName; readonly class?: string };
export type IconName =
  | "play"
  | "clock"
  | "doc"
  | "plus"
  | "chevronRight"
  | "list"
  | "table"
  | "arrowLeft"
  | "sliders"
  | "check";

/**
 * Shared stroke-icon shell — 24px-grid, feather-style attributes. Every icon
 * factory in the app previously re-declared this 7-attribute array (34 clone
 * groups); views build their glyphs on this shell instead.
 */
export const svgIcon = <M>(
  classes: string,
  h: HtmlBuilder<M>,
  children: ReadonlyArray<Html | string>,
  strokeWidth = "2",
) =>
  h.svg(
    [
      h.Class(classes),
      h.Attribute("viewBox", "0 0 24 24"),
      h.Attribute("fill", "none"),
      h.Attribute("stroke", "currentColor"),
      h.Attribute("stroke-width", strokeWidth),
      h.Attribute("stroke-linecap", "round"),
      h.Attribute("stroke-linejoin", "round"),
    ],
    children,
  );

/** Stroke-based 24px-grid icons, feather-style, sized via the class string. */
export const icon = <M>({ name, class: classes = "h-5 w-5" }: IconProps, h: HtmlBuilder<M>) => {
  const stroke = [
    h.Attribute("viewBox", "0 0 24 24"),
    h.Attribute("fill", "none"),
    h.Attribute("stroke", "currentColor"),
    h.Attribute("stroke-width", "2"),
    h.Attribute("stroke-linecap", "round"),
    h.Attribute("stroke-linejoin", "round"),
  ];
  switch (name) {
    case "play":
      return h.svg(
        [...stroke, h.Class(classes)],
        [h.path([h.Attribute("d", "M6 4l14 8-14 8V4z"), h.Attribute("fill", "currentColor")], [])],
      );
    case "clock":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
          h.polyline([h.Attribute("points", "12 7 12 12 15.5 13.5")], []),
        ],
      );
    case "doc":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.path(
            [h.Attribute("d", "M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z")],
            [],
          ),
          h.polyline([h.Attribute("points", "14 2 14 7 19 7")], []),
          h.line(
            [
              h.Attribute("x1", "9"),
              h.Attribute("y1", "12"),
              h.Attribute("x2", "15"),
              h.Attribute("y2", "12"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "9"),
              h.Attribute("y1", "16"),
              h.Attribute("x2", "13"),
              h.Attribute("y2", "16"),
            ],
            [],
          ),
        ],
      );
    case "plus":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.line(
            [
              h.Attribute("x1", "12"),
              h.Attribute("y1", "5"),
              h.Attribute("x2", "12"),
              h.Attribute("y2", "19"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "5"),
              h.Attribute("y1", "12"),
              h.Attribute("x2", "19"),
              h.Attribute("y2", "12"),
            ],
            [],
          ),
        ],
      );
    case "chevronRight":
      return h.svg(
        [...stroke, h.Class(classes)],
        [h.polyline([h.Attribute("points", "9 5 16 12 9 19")], [])],
      );
    case "arrowLeft":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.line(
            [
              h.Attribute("x1", "19"),
              h.Attribute("y1", "12"),
              h.Attribute("x2", "5"),
              h.Attribute("y2", "12"),
            ],
            [],
          ),
          h.polyline([h.Attribute("points", "12 19 5 12 12 5")], []),
        ],
      );
    case "table":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.rect(
            [
              h.Attribute("x", "3"),
              h.Attribute("y", "3"),
              h.Attribute("width", "18"),
              h.Attribute("height", "18"),
              h.Attribute("rx", "2"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "3"),
              h.Attribute("y1", "9"),
              h.Attribute("x2", "21"),
              h.Attribute("y2", "9"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "9"),
              h.Attribute("y1", "9"),
              h.Attribute("x2", "9"),
              h.Attribute("y2", "21"),
            ],
            [],
          ),
        ],
      );
    case "sliders":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.line(
            [
              h.Attribute("x1", "4"),
              h.Attribute("y1", "21"),
              h.Attribute("x2", "4"),
              h.Attribute("y2", "14"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "4"),
              h.Attribute("y1", "10"),
              h.Attribute("x2", "4"),
              h.Attribute("y2", "3"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "12"),
              h.Attribute("y1", "21"),
              h.Attribute("x2", "12"),
              h.Attribute("y2", "12"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "12"),
              h.Attribute("y1", "8"),
              h.Attribute("x2", "12"),
              h.Attribute("y2", "3"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "20"),
              h.Attribute("y1", "21"),
              h.Attribute("x2", "20"),
              h.Attribute("y2", "16"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "20"),
              h.Attribute("y1", "12"),
              h.Attribute("x2", "20"),
              h.Attribute("y2", "3"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "1"),
              h.Attribute("y1", "14"),
              h.Attribute("x2", "7"),
              h.Attribute("y2", "14"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "9"),
              h.Attribute("y1", "8"),
              h.Attribute("x2", "15"),
              h.Attribute("y2", "8"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "17"),
              h.Attribute("y1", "16"),
              h.Attribute("x2", "23"),
              h.Attribute("y2", "16"),
            ],
            [],
          ),
        ],
      );
    case "check":
      return h.svg(
        [...stroke, h.Class(classes)],
        [h.polyline([h.Attribute("points", "20 6 9 17 4 12")], [])],
      );
    case "list":
      return h.svg(
        [...stroke, h.Class(classes)],
        [
          h.line(
            [
              h.Attribute("x1", "8"),
              h.Attribute("y1", "6"),
              h.Attribute("x2", "20"),
              h.Attribute("y2", "6"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "8"),
              h.Attribute("y1", "12"),
              h.Attribute("x2", "20"),
              h.Attribute("y2", "12"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "8"),
              h.Attribute("y1", "18"),
              h.Attribute("x2", "20"),
              h.Attribute("y2", "18"),
            ],
            [],
          ),
          h.circle(
            [
              h.Attribute("cx", "4"),
              h.Attribute("cy", "6"),
              h.Attribute("r", "1"),
              h.Attribute("fill", "currentColor"),
            ],
            [],
          ),
          h.circle(
            [
              h.Attribute("cx", "4"),
              h.Attribute("cy", "12"),
              h.Attribute("r", "1"),
              h.Attribute("fill", "currentColor"),
            ],
            [],
          ),
          h.circle(
            [
              h.Attribute("cx", "4"),
              h.Attribute("cy", "18"),
              h.Attribute("r", "1"),
              h.Attribute("fill", "currentColor"),
            ],
            [],
          ),
        ],
      );
  }
};

// ── Building blocks ──────────────────────────────────────────────────────

type TabDef = {
  readonly tag: "StartTab" | "HistoryTab" | "TemplatesTab";
  readonly label: string;
  readonly icon: IconName;
};

const TABS: ReadonlyArray<TabDef> = [
  { tag: "StartTab", label: "Session", icon: "play" },
  { tag: "HistoryTab", label: "History", icon: "clock" },
  { tag: "TemplatesTab", label: "Templates", icon: "doc" },
];

/**
 * Bottom tab bar for mobile viewports (< md). Safe-area aware; hidden on full-screen routes and md+.
 * Anchors drive hash routing — no JS navigation needed.
 */
export const bottomTabBar = <M>(route: Route, h: HtmlBuilder<M>) =>
  h.nav(
    [
      h.Class(
        "md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg select-none shadow-lg",
      ),
      h.AriaLabel("Mobile bottom navigation"),
    ],
    [
      h.div(
        [h.Class("mx-auto grid h-14 max-w-md grid-cols-3 items-center px-2")],
        TABS.map((tab) => {
          const active = route._tag === tab.tag;
          const href = hrefFor({ _tag: tab.tag });
          return h.a(
            [
              h.Class(
                `flex h-full flex-col items-center justify-center transition-all duration-150 rounded-xl py-1 active:scale-95 ${
                  active
                    ? "text-primary font-semibold"
                    : "text-base-content/50 hover:text-base-content/80"
                }`,
              ),
              h.Attribute("href", href),
              h.AriaLabel(tab.label),
              ...(active ? [h.AriaCurrent("page")] : []),
            ],
            [
              h.div(
                [
                  h.Class(
                    `flex items-center justify-center px-3 py-0.5 rounded-full transition-colors ${
                      active ? "bg-primary/15" : "bg-transparent"
                    }`,
                  ),
                ],
                [icon({ name: tab.icon, class: "h-5 w-5" }, h)],
              ),
              h.span([h.Class("mt-0.5 text-[11px] tracking-tight")], [tab.label]),
            ],
          );
        }),
      ),
    ],
  );

/**
 * Unified Top Bar:
 * - On mobile (< md): Clean centered title with optional back button or trailing action.
 * - On desktop (>= md): Full desktop app header with branding, tab navigation bar, and context actions.
 */
export const topBar = <M>(
  title: string,
  route: Route,
  trailing: ReturnType<HtmlBuilder<M>["div"]> | null,
  h: HtmlBuilder<M>,
) => {
  const backTarget = (() => {
    if (route._tag === "TemplateEditor") return hrefFor({ _tag: "TemplatesTab" });
    if (route._tag === "SessionDetail") return hrefFor({ _tag: "HistoryTab" });
    return null;
  })();

  return h.header(
    [
      h.Class(
        "sticky top-0 z-30 w-full border-b border-base-300 bg-base-100/90 pt-[env(safe-area-inset-top)] backdrop-blur-md select-none shadow-xs",
      ),
    ],
    [
      h.div(
        [
          h.Class(
            "mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8",
          ),
        ],
        [
          // Left: Logo & App Title on desktop, Back button or spacer on mobile
          h.div(
            [h.Class("flex items-center gap-3 min-w-24")],
            backTarget !== null
              ? [
                  h.a(
                    [
                      h.Class(
                        "btn btn-ghost btn-sm -ml-2 text-primary font-medium gap-1 hover:bg-base-200 active:scale-95 transition-transform",
                      ),
                      h.Attribute("href", backTarget),
                      h.AriaLabel("Back"),
                    ],
                    [
                      icon({ name: "arrowLeft", class: "h-4 w-4" }, h),
                      h.span([h.Class("text-sm font-medium")], ["Back"]),
                    ],
                  ),
                ]
              : [
                  // Desktop branding
                  h.a(
                    [
                      h.Class(
                        "hidden md:flex items-center gap-2 text-base font-bold tracking-tight hover:opacity-80 transition-opacity",
                      ),
                      h.Attribute("href", hrefFor({ _tag: "StartTab" })),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            "flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white text-base font-serif shadow-xs",
                          ),
                        ],
                        ["θ"],
                      ),
                      h.span([h.Class("text-base font-semibold")], ["optio"]),
                    ],
                  ),
                ],
          ),

          // Center: Mobile centered title & Desktop top tabs navigation
          h.div(
            [h.Class("flex items-center justify-center flex-1")],
            [
              // Mobile view title
              h.h1(
                [
                  h.Class(
                    "md:hidden max-w-[200px] truncate text-center text-base font-semibold tracking-tight text-base-content",
                  ),
                ],
                [title],
              ),

              // Desktop view tab navigation bar
              ...(!isFullScreenRoute(route)
                ? [
                    h.nav(
                      [
                        h.Class(
                          "hidden md:flex items-center gap-1 bg-base-200/80 p-1 rounded-box border border-base-300/80",
                        ),
                        h.AriaLabel("Desktop navigation"),
                      ],
                      TABS.map((tab) => {
                        const active = route._tag === tab.tag;
                        const href = hrefFor({ _tag: tab.tag });
                        return h.a(
                          [
                            h.Class(
                              `flex items-center gap-2 px-4 py-1.5 rounded-field text-xs font-semibold transition-all duration-150 ${
                                active
                                  ? "bg-base-100 text-primary shadow-xs"
                                  : "text-base-content/60 hover:text-base-content hover:bg-base-100/50"
                              }`,
                            ),
                            h.Attribute("href", href),
                            ...(active ? [h.AriaCurrent("page")] : []),
                          ],
                          [
                            icon({ name: tab.icon, class: "h-3.5 w-3.5" }, h),
                            h.span([], [tab.label]),
                          ],
                        );
                      }),
                    ),
                  ]
                : [
                    // When on full screen route on desktop, display page title
                    h.h1(
                      [
                        h.Class(
                          "hidden md:block text-base font-semibold tracking-tight text-base-content",
                        ),
                      ],
                      [title],
                    ),
                  ]),
            ],
          ),

          // Right: Context action slot (e.g. + Create Template)
          h.div(
            [h.Class("flex min-w-24 items-center justify-end")],
            trailing === null ? [] : [trailing],
          ),
        ],
      ),
    ],
  );
};
