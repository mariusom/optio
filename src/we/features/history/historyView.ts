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

const formatRange = (startedAt: number, endedAt: number): string => {
  const s = formatTimestamp(startedAt);
  const e = formatTimestamp(endedAt);
  return `${s} - ${e}`;
};

const sessionRowView = (session: HistoryModel["history"][number], h: HtmlBuilder<Message>) => {
  const timeRange = formatRange(session.startedAt, session.endedAt);
  const hasCustomName = session.sessionName !== "";
  return h.div(
    // Micro-scale press feedback (design system §4.2) — active propagates from
    // the row button, giving a tactile "press" without framework churn.
    [
      h.Class(
        "flex items-stretch bg-base-100 active:scale-[0.98] active:opacity-80 transition-transform duration-75",
      ),
    ],
    [
      h.button(
        [
          h.Class(
            "flex min-w-0 grow cursor-pointer flex-col items-start gap-0.5 px-4 py-3.5 text-left select-none active:bg-base-200/70",
          ),
          h.OnClick(Message.ClickedHistoryRow({ id: session.id })),
          h.AriaLabel(`Open session ${session.displayName}`),
        ],
        [
          h.span([h.Class("truncate text-sm font-semibold")], [session.displayName]),
          ...(hasCustomName
            ? [
                h.span(
                  [h.Class("text-xs text-base-content/60")],
                  [`Template: ${session.templateName}`],
                ),
              ]
            : []),
          h.span([h.Class("text-xs text-base-content/60")], [timeRange]),
          h.span([h.Class("text-xs text-base-content/50")], [`${session.taskCount} events`]),
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
                    "dropdown-content menu z-40 mt-1 w-44 rounded-box border border-base-300 bg-base-100 p-1.5 text-sm shadow-lg",
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
                "mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-300/60 text-base-content/50",
              ),
            ],
            [clockQuestionIcon("h-7 w-7", h)],
          ),
          h.h3([h.Class("text-base font-semibold text-base-content")], ["No sessions yet"]),
          h.p(
            [h.Class("mt-1 text-xs leading-relaxed text-base-content/60")],
            ["Finish a session and it will appear here, ready for CSV export."],
          ),
          // Unified empty-state pattern: icon / title / message / action.
          // Same primary-action chrome as the NoTemplates empty state.
          h.a(
            [
              h.Class(
                "btn btn-primary mt-5 rounded-field gap-1.5 text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform",
              ),
              h.Attribute("href", "#/start"),
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
    [h.Class("modal modal-open")],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5 bg-base-100")],
        [
          h.h3([h.Class("text-base font-bold")], ["Delete?"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")],
            [
              `Are you sure you want to delete "${pending.displayName}"? This action cannot be undone.`,
            ],
          ),
          h.div(
            [h.Class("modal-action mt-4 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedHistoryDelete()),
                ],
                ["Delete"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledHistoryDelete()),
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
    [h.Class("mx-auto max-w-3xl px-4 pt-3")],
    [
      h.div(
        [h.Class("alert alert-warning py-2 text-sm flex items-center justify-between gap-2")],
        [
          h.span([h.Class("flex-1")], [error]),
          h.button(
            [h.Class("btn btn-ghost btn-xs"), h.OnClick(Message.DismissedCsvError())],
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
      // List container
      h.div(
        [h.Class("mx-auto w-full max-w-3xl px-4 pt-3")],
        [
          h.div(
            [
              h.Class(
                "divide-y divide-base-200 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm",
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
