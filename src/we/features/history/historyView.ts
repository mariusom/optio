import { svgIcon } from "../../ui";
import type { HtmlBuilder } from "foldkit/html";
import { Message } from "../../../messages";
import { formatTimestamp } from "../../format";

// Model shape expected
type HistoryModel = {
  readonly history: ReadonlyArray<{
    readonly id: string;
    readonly displayName: string;
    readonly templateName: string;
    readonly sessionName: string;
    readonly startedAt: number;
    readonly endedAt: number;
    readonly taskCount: number;
  }>;
  readonly pendingHistoryDelete: { readonly id: string; readonly displayName: string } | null;
  readonly csvError: string | null;
};

const clockQuestionIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(
    classes,
    h,
    [
      h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
      h.polyline([h.Attribute("points", "12 7 12 12 15 10")], []),
      h.circle(
        [
          h.Attribute("cx", "12"),
          h.Attribute("cy", "16"),
          h.Attribute("r", "0.5"),
          h.Attribute("fill", "currentColor"),
        ],
        [],
      ),
      h.path([h.Attribute("d", "M9 9a3 3 0 0 1 5.2 2 3 3 0 0 1-1.2 2.5")], []),
    ],
    "1.8",
  );

const chevronRight = (h: HtmlBuilder<Message>) =>
  h.svg(
    [
      h.Class("h-4 w-4 shrink-0 text-base-content/30"),
      h.Attribute("viewBox", "0 0 24 24"),
      h.Attribute("fill", "none"),
      h.Attribute("stroke", "currentColor"),
      h.Attribute("stroke-width", "2"),
      h.Attribute("stroke-linecap", "round"),
      h.Attribute("stroke-linejoin", "round"),
    ],
    [h.polyline([h.Attribute("points", "9 5 16 12 9 19")], [])],
  );

const downloadIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(
    classes,
    h,
    [
      h.path([h.Attribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4")], []),
      h.polyline([h.Attribute("points", "7 10 12 15 17 10")], []),
      h.line(
        [
          h.Attribute("x1", "12"),
          h.Attribute("y1", "15"),
          h.Attribute("x2", "12"),
          h.Attribute("y2", "3"),
        ],
        [],
      ),
    ],
    "1.8",
  );

const trashIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(
    classes,
    h,
    [
      h.polyline([h.Attribute("points", "3 6 5 6 21 6")], []),
      h.path(
        [
          h.Attribute(
            "d",
            "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
          ),
        ],
        [],
      ),
    ],
    "1.8",
  );

const formatRange = (startedAt: number, endedAt: number): string => {
  const s = formatTimestamp(startedAt);
  const e = formatTimestamp(endedAt);
  return `${s} - ${e}`;
};

const sessionRowView = (session: HistoryModel["history"][number], h: HtmlBuilder<Message>) => {
  const timeRange = formatRange(session.startedAt, session.endedAt);
  const hasCustomName = session.sessionName !== "";
  return h.div(
    [
      h.Class(
        "flex items-stretch bg-base-100 active:scale-[0.99] active:bg-base-200/50 transition-all duration-75",
      ),
    ],
    [
      h.button(
        [
          h.Class(
            "flex min-w-0 grow cursor-pointer flex-col items-start gap-1 px-4 py-3.5 text-left select-none",
          ),
          h.OnClick(Message.ClickedHistoryRow({ id: session.id })),
          h.AriaLabel(`Open session ${session.displayName}`),
        ],
        [
          h.div(
            [h.Class("flex items-center gap-2 w-full")],
            [
              h.span(
                [h.Class("truncate text-sm font-semibold text-base-content")],
                [session.displayName],
              ),
              h.div([h.Class("flex-1")], []),
              h.span(
                [h.Class("badge badge-sm badge-neutral font-mono text-[10px]")],
                [`${session.taskCount} tasks`],
              ),
            ],
          ),
          ...(hasCustomName
            ? [
                h.span(
                  [h.Class("text-xs text-base-content/70")],
                  [`Template: ${session.templateName}`],
                ),
              ]
            : []),
          h.span([h.Class("text-xs font-mono text-base-content/50")], [timeRange]),
        ],
      ),
      h.div(
        [h.Class("flex items-center gap-1 pr-2 self-center")],
        [
          chevronRight(h),
          // context menu — dropdown with Export / Delete
          h.div(
            [h.Class("dropdown dropdown-end")],
            [
              h.div(
                [
                  h.Tabindex(0),
                  h.Class("btn btn-ghost btn-sm btn-circle"),
                  h.AriaLabel(`Actions for "${session.displayName}"`),
                ],
                [h.span([h.Class("text-xl leading-none")], ["⋯"])],
              ),
              h.ul(
                [
                  h.Tabindex(0),
                  h.Class(
                    "dropdown-content menu z-40 mt-1 w-44 rounded-box border border-base-300 bg-base-100 p-1.5 text-sm shadow-xl",
                  ),
                ],
                [
                  ...(session.taskCount > 0
                    ? [
                        h.li(
                          [],
                          [
                            h.button(
                              [
                                h.OnClick(
                                  Message.ClickedExportHistoryCsv({ sessionId: session.id }),
                                ),
                                h.AriaLabel(`Export CSV for ${session.displayName}`),
                              ],
                              ["Export CSV"],
                            ),
                          ],
                        ),
                      ]
                    : []),
                  h.li(
                    [],
                    [
                      h.button(
                        [
                          h.Class("text-error"),
                          h.OnClick(
                            Message.RequestedHistoryDelete({
                              id: session.id,
                              displayName: session.displayName,
                            }),
                          ),
                          h.AriaLabel(`Delete session ${session.displayName}`),
                        ],
                        ["Delete"],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

// ── Desktop / Tablet Data Table ─────────────────────────────────────────────

const desktopHistoryTable = (history: HistoryModel["history"], h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        "hidden md:block w-full overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-xs",
      ),
    ],
    [
      h.table(
        [h.Class("table table-zebra table-hover w-full text-sm")],
        [
          h.thead(
            [h.Class("bg-base-200/80 text-xs uppercase tracking-wider text-base-content/70")],
            [
              h.tr(
                [],
                [
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold")],
                    ["Session Name"],
                  ),
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold")],
                    ["Template"],
                  ),
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold")],
                    ["Recorded Period"],
                  ),
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold text-center")],
                    ["Tasks"],
                  ),
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold text-right")],
                    ["Actions"],
                  ),
                ],
              ),
            ],
          ),
          h.tbody(
            [h.Class("divide-y divide-base-200")],
            history.map((session) => {
              const timeRange = formatRange(session.startedAt, session.endedAt);
              return h.tr(
                [
                  h.Class("cursor-pointer hover:bg-base-200/50 transition-colors group"),
                  h.OnClick(Message.ClickedHistoryRow({ id: session.id })),
                ],
                [
                  h.td(
                    [h.Class("py-3.5 px-4 font-semibold text-base-content")],
                    [
                      h.div(
                        [h.Class("flex items-center gap-2")],
                        [
                          h.span(
                            [h.Class("group-hover:text-primary transition-colors")],
                            [session.displayName],
                          ),
                        ],
                      ),
                    ],
                  ),
                  h.td([h.Class("py-3.5 px-4 text-base-content/70")], [session.templateName]),
                  h.td(
                    [h.Class("py-3.5 px-4 font-mono text-xs text-base-content/60")],
                    [timeRange],
                  ),
                  h.td(
                    [h.Class("py-3.5 px-4 text-center")],
                    [
                      h.span(
                        [h.Class("badge badge-sm badge-neutral font-mono font-medium")],
                        [`${session.taskCount}`],
                      ),
                    ],
                  ),
                  h.td(
                    [h.Class("py-3.5 px-4 text-right")],
                    [
                      h.div(
                        [
                          h.Class("flex items-center justify-end gap-1.5"),
                          h.Attribute("onclick", "event.stopPropagation()"),
                        ],
                        [
                          ...(session.taskCount > 0
                            ? [
                                h.button(
                                  [
                                    h.Class(
                                      "btn btn-ghost btn-xs rounded-field gap-1 text-primary hover:bg-primary/10",
                                    ),
                                    h.OnClick(
                                      Message.ClickedExportHistoryCsv({ sessionId: session.id }),
                                    ),
                                    h.AriaLabel(`Export CSV for ${session.displayName}`),
                                  ],
                                  [
                                    downloadIcon("h-3.5 w-3.5", h),
                                    h.span(
                                      [h.Class("hidden lg:inline text-xs font-semibold")],
                                      ["CSV"],
                                    ),
                                  ],
                                ),
                              ]
                            : []),
                          h.button(
                            [
                              h.Class(
                                "btn btn-ghost btn-xs btn-circle text-error/70 hover:text-error hover:bg-error/10",
                              ),
                              h.OnClick(
                                Message.RequestedHistoryDelete({
                                  id: session.id,
                                  displayName: session.displayName,
                                }),
                              ),
                              h.AriaLabel(`Delete ${session.displayName}`),
                            ],
                            [trashIcon("h-3.5 w-3.5", h)],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    ],
  );

const emptyState = (h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("flex min-h-full flex-col")],
    [
      h.div(
        [
          h.Class(
            "mx-auto my-auto flex max-w-sm flex-col items-center justify-center p-8 text-center",
          ),
        ],
        [
          h.div(
            [
              h.Class(
                "mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-300/60 text-base-content/50 shadow-xs",
              ),
            ],
            [clockQuestionIcon("h-8 w-8", h)],
          ),
          h.h3([h.Class("text-base font-bold text-base-content")], ["No sessions yet"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/60")],
            ["Finish a session and it will appear here, ready for CSV export."],
          ),
          h.a(
            [
              h.Class(
                "btn btn-primary mt-6 rounded-field gap-2 text-sm font-semibold shadow-sm active:scale-[0.98] transition-all px-6",
              ),
              h.Attribute("href", "#/start"),
              h.AriaLabel("Start a Session"),
            ],
            [h.span([h.Class("text-lg leading-none")], ["+"]), "Start a Session"],
          ),
        ],
      ),
    ],
  );

const deleteModal = (
  pending: { readonly id: string; readonly displayName: string },
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [
      h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
      h.AriaLabel("Delete session confirmation"),
    ],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5 bg-base-100")],
        [
          h.h3([h.Class("text-base font-bold text-base-content")], ["Delete Session?"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")],
            [
              `Are you sure you want to delete "${pending.displayName}"? This action cannot be undone.`,
            ],
          ),
          h.div(
            [h.Class("modal-action mt-5 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedHistoryDelete()),
                  h.AriaLabel("Confirm delete"),
                ],
                ["Delete"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledHistoryDelete()),
                  h.AriaLabel("Cancel delete"),
                ],
                ["Cancel"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledHistoryDelete())], []),
    ],
  );

const errorAlert = (error: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-3")],
    [
      h.div(
        [
          h.Class(
            "alert alert-warning py-2 text-sm flex items-center justify-between gap-2 shadow-xs",
          ),
        ],
        [
          h.span([h.Class("flex-1")], [error]),
          h.button(
            [
              h.Class("btn btn-ghost btn-xs"),
              h.OnClick(Message.DismissedCsvError()),
              h.AriaLabel("Dismiss error"),
            ],
            ["✕"],
          ),
        ],
      ),
    ],
  );

export const historyPage = (model: HistoryModel, h: HtmlBuilder<Message>) => {
  if (model.history.length === 0) {
    return h.div(
      [h.Class("min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))]")],
      [
        emptyState(h),
        ...(model.pendingHistoryDelete ? [deleteModal(model.pendingHistoryDelete, h)] : []),
        ...(model.csvError ? [errorAlert(model.csvError, h)] : []),
      ],
    );
  }

  return h.div(
    [h.Class("min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))]")],
    [
      h.div(
        [h.Class("mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4")],
        [
          // Desktop & Tablet table
          desktopHistoryTable(model.history, h),

          // Mobile card list
          h.div(
            [
              h.Class(
                "md:hidden divide-y divide-base-200 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-xs",
              ),
            ],
            model.history.map((session) => sessionRowView(session, h)),
          ),
        ],
      ),
      ...(model.pendingHistoryDelete ? [deleteModal(model.pendingHistoryDelete, h)] : []),
      ...(model.csvError ? [errorAlert(model.csvError, h)] : []),
    ],
  );
};
