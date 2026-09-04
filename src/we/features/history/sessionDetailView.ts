import { svgIcon } from "../../ui";
import type { HtmlBuilder } from "foldkit/html";
import { Message } from "../../../messages";
import { formatDurationHm, formatTimestamp, formatTimeOnly, formatDurationHms } from "../../format";
import { editSessionNameSheet } from "./editSessionNameSheet";
import { taskDetailView } from "./taskDetailView";

type SessionDetailTask = {
  readonly id: string;
  readonly taskId: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly sections: ReadonlyArray<{
    readonly sectionName: string;
    readonly value: string;
    readonly sectionType: string;
    readonly isRequired: boolean;
    readonly startedAt: number | null;
  }>;
};

type SessionDetailModel = {
  readonly selectedHistorySession: {
    readonly id: string;
    readonly sessionName: string;
    readonly templateName: string;
    readonly startedAt: number;
    readonly endedAt: number | null;
    readonly taskCount: number;
    readonly tasks: ReadonlyArray<SessionDetailTask>;
  } | null;
  readonly showEditHistoryName: boolean;
  readonly editHistoryNameInput: string;
  readonly selectedHistoryTaskId: string | null;
  readonly csvError: string | null;
};

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

const clockTinyIcon = (h: HtmlBuilder<Message>) =>
  svgIcon("h-3 w-3 shrink-0 text-base-content/50", h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.polyline([h.Attribute("points", "12 7 12 12 15 15")], []),
  ]);

const badge = (taskId: number, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0",
      ),
    ],
    [String(taskId)],
  );

const taskRowView = (t: SessionDetailTask, h: HtmlBuilder<Message>) => {
  const duration =
    t.startedAt !== null && t.endedAt !== null ? formatDurationHms(t.endedAt - t.startedAt) : null;
  const startLabel = t.startedAt !== null ? formatTimeOnly(t.startedAt) : null;
  const nonEmpty = t.sections.filter((s) => s.value !== "");
  const preview = nonEmpty.slice(0, 3);
  const more = nonEmpty.length > 3 ? nonEmpty.length - 3 : 0;
  return h.div(
    [h.Class("flex items-stretch bg-base-100 hover:bg-base-200/40 transition-colors")],
    [
      h.button(
        [
          h.Class(
            "flex min-w-0 grow cursor-pointer items-center gap-3 px-4 py-3.5 text-left select-none active:bg-base-200/60 transition-colors",
          ),
          h.OnClick(Message.ClickedHistoryTask({ taskId: t.id })),
          h.AriaLabel(`View details for Task ${t.taskId}`),
        ],
        [
          badge(t.taskId, h),
          h.div(
            [h.Class("flex min-w-0 flex-1 flex-col gap-1")],
            [
              h.div(
                [h.Class("flex items-center gap-2")],
                [
                  h.span(
                    [h.Class("text-sm font-semibold text-base-content")],
                    [`Task ${t.taskId}`],
                  ),
                  ...(startLabel
                    ? [
                        h.span(
                          [h.Class("text-xs font-mono text-base-content/60 ml-auto")],
                          [startLabel],
                        ),
                      ]
                    : []),
                  ...(duration
                    ? [
                        h.span(
                          [
                            h.Class(
                              "flex items-center gap-1 text-xs font-mono text-base-content/70 border border-base-300 rounded-full px-2 py-0.5 ml-1 bg-base-200/50",
                            ),
                          ],
                          [clockTinyIcon(h), duration],
                        ),
                      ]
                    : []),
                ],
              ),
              ...(preview.length > 0
                ? [
                    h.div(
                      [h.Class("flex flex-col gap-0.5 pt-0.5")],
                      preview.map((s) => {
                        const valLower = s.value.trim().toLowerCase();
                        const displayVal =
                          valLower === "true" ? "Yes" : valLower === "false" ? "No" : s.value;
                        return h.div(
                          [h.Class("flex items-baseline gap-2 text-xs")],
                          [
                            h.span(
                              [h.Class("min-w-[60px] shrink-0 text-base-content/50 font-medium")],
                              [s.sectionName],
                            ),
                            h.span([h.Class("truncate text-base-content/80")], [displayVal]),
                          ],
                        );
                      }),
                    ),
                  ]
                : []),
              ...(more > 0
                ? [
                    h.span(
                      [h.Class("text-[11px] text-base-content/50 font-medium")],
                      [`+${more} more fields`],
                    ),
                  ]
                : []),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("flex items-center gap-1 pr-2 self-center")],
        [
          chevronRight(h),
          // context menu — View Details
          h.div(
            [h.Class("dropdown dropdown-end")],
            [
              h.div(
                [
                  h.Tabindex(0),
                  h.Class("btn btn-ghost btn-sm btn-circle"),
                  h.AriaLabel(`Actions for Task ${t.taskId}`),
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
                  h.li(
                    [],
                    [
                      h.button(
                        [
                          h.OnClick(Message.ClickedHistoryTask({ taskId: t.id })),
                          h.AriaLabel(`View details for Task ${t.taskId}`),
                        ],
                        ["View Details"],
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

export const sessionDetailPage = (model: SessionDetailModel, h: HtmlBuilder<Message>) => {
  const detail = model.selectedHistorySession;
  if (detail === null) {
    return h.div(
      [h.Class("flex min-h-full flex-col items-center justify-center p-8 text-center")],
      [
        h.div([h.Class("loading loading-spinner loading-md text-base-content/40")], []),
        h.p([h.Class("mt-3 text-sm text-base-content/60")], ["Loading session…"]),
        ...(model.csvError
          ? [h.div([h.Class("alert alert-warning mt-4 max-w-sm py-2 text-sm")], [model.csvError])]
          : []),
      ],
    );
  }

  const duration =
    detail.endedAt !== null ? formatDurationHm(detail.endedAt - detail.startedAt) : null;
  const displayName = detail.sessionName !== "" ? detail.sessionName : detail.templateName;
  const isCustomName = detail.sessionName !== "";
  const sortedTasks = [...detail.tasks].sort((a, b) => {
    const aStart = a.startedAt ?? Date.now();
    const bStart = b.startedAt ?? Date.now();
    return aStart - bStart;
  });

  const selectedTask =
    model.selectedHistoryTaskId !== null
      ? (detail.tasks.find((t) => t.id === model.selectedHistoryTaskId) ?? null)
      : null;

  const canExport = detail.endedAt !== null && detail.taskCount > 0;

  return h.div(
    [h.Class("min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col")],
    [
      h.div(
        [h.Class("mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6 flex-1")],
        [
          // Responsive Grid on lg screens
          h.div(
            [h.Class("grid grid-cols-1 lg:grid-cols-3 gap-6 items-start")],
            [
              // Left: Session Info card & Actions (1 col on lg)
              h.div(
                [h.Class("space-y-4 lg:col-span-1")],
                [
                  h.div(
                    [
                      h.Class(
                        "rounded-box bg-base-100 border border-base-300 shadow-xs overflow-hidden",
                      ),
                    ],
                    [
                      h.div(
                        [h.Class("px-4 py-2.5 bg-base-200/60 border-b border-base-200")],
                        [
                          h.span(
                            [
                              h.Class(
                                "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                              ),
                            ],
                            ["Session Info"],
                          ),
                        ],
                      ),
                      h.div(
                        [h.Class("divide-y divide-base-200")],
                        [
                          // Name row — button to edit
                          h.button(
                            [
                              h.Class(
                                "flex w-full items-center justify-between px-4 py-3 text-left hover:bg-base-200/40 active:bg-base-200/70 transition-colors",
                              ),
                              h.OnClick(Message.ClickedEditHistoryName()),
                              h.AriaLabel("Edit session name"),
                            ],
                            [
                              h.span([h.Class("text-sm text-base-content/60")], ["Name"]),
                              h.span(
                                [h.Class("flex items-center gap-1 text-sm font-medium")],
                                [
                                  h.span(
                                    [
                                      h.Class(
                                        isCustomName
                                          ? "text-base-content font-semibold"
                                          : "text-primary",
                                      ),
                                    ],
                                    [isCustomName ? displayName : "Add Name"],
                                  ),
                                  h.span([h.Class("text-base-content/30 text-xs")], ["›"]),
                                ],
                              ),
                            ],
                          ),
                          h.div(
                            [h.Class("flex items-center justify-between px-4 py-3")],
                            [
                              h.span([h.Class("text-sm text-base-content/60")], ["Template"]),
                              h.span(
                                [h.Class("text-sm font-semibold text-base-content")],
                                [detail.templateName],
                              ),
                            ],
                          ),
                          h.div(
                            [h.Class("flex items-center justify-between px-4 py-3")],
                            [
                              h.span([h.Class("text-sm text-base-content/60")], ["Started"]),
                              h.span(
                                [h.Class("text-xs font-mono text-base-content/80")],
                                [formatTimestamp(detail.startedAt)],
                              ),
                            ],
                          ),
                          ...(detail.endedAt !== null
                            ? [
                                h.div(
                                  [h.Class("flex items-center justify-between px-4 py-3")],
                                  [
                                    h.span([h.Class("text-sm text-base-content/60")], ["Ended"]),
                                    h.span(
                                      [h.Class("text-xs font-mono text-base-content/80")],
                                      [formatTimestamp(detail.endedAt)],
                                    ),
                                  ],
                                ),
                                ...(duration
                                  ? [
                                      h.div(
                                        [h.Class("flex items-center justify-between px-4 py-3")],
                                        [
                                          h.span(
                                            [h.Class("text-sm text-base-content/60")],
                                            ["Duration"],
                                          ),
                                          h.span(
                                            [h.Class("text-sm font-semibold text-base-content")],
                                            [duration],
                                          ),
                                        ],
                                      ),
                                    ]
                                  : []),
                              ]
                            : []),
                          h.div(
                            [h.Class("flex items-center justify-between px-4 py-3")],
                            [
                              h.span([h.Class("text-sm text-base-content/60")], ["Total Tasks"]),
                              h.span(
                                [h.Class("badge badge-sm badge-neutral font-mono")],
                                [String(detail.taskCount)],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Toolbar Export CSV
                  ...(canExport
                    ? [
                        h.button(
                          [
                            h.Class(
                              "btn btn-primary btn-block rounded-field gap-2 text-sm font-semibold shadow-xs active:scale-[0.98]",
                            ),
                            h.OnClick(Message.ClickedExportHistoryCsv({ sessionId: detail.id })),
                            h.AriaLabel("Export Session CSV"),
                          ],
                          ["Export Session CSV"],
                        ),
                      ]
                    : []),
                ],
              ),

              // Right: Tasks List (2 cols on lg)
              h.div(
                [h.Class("space-y-4 lg:col-span-2")],
                [
                  h.div(
                    [
                      h.Class(
                        "rounded-box bg-base-100 border border-base-300 shadow-xs overflow-hidden",
                      ),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            "flex items-center justify-between px-4 py-2.5 bg-base-200/60 border-b border-base-200",
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class(
                                "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                              ),
                            ],
                            ["Recorded Tasks"],
                          ),
                          h.span(
                            [h.Class("badge badge-sm badge-neutral font-mono")],
                            [`${detail.taskCount} tasks`],
                          ),
                        ],
                      ),
                      ...(sortedTasks.length === 0
                        ? [
                            h.div(
                              [
                                h.Class(
                                  "px-4 py-8 text-center text-sm italic text-base-content/50",
                                ),
                              ],
                              ["No tasks recorded in this session."],
                            ),
                          ]
                        : [
                            h.div(
                              [h.Class("divide-y divide-base-200")],
                              sortedTasks.map((task) => taskRowView(task, h)),
                            ),
                          ]),
                    ],
                  ),
                ],
              ),
            ],
          ),

          ...(model.csvError
            ? [
                h.div(
                  [
                    h.Class(
                      "alert alert-warning py-2 text-sm flex items-center justify-between shadow-xs",
                    ),
                  ],
                  [
                    h.span([], [model.csvError]),
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
              ]
            : []),
        ],
      ),
      // Task detail sheet
      ...(selectedTask ? [taskDetailView({ task: selectedTask }, h)] : []),
      // Edit name sheet
      editSessionNameSheet(
        {
          showEditHistoryName: model.showEditHistoryName,
          editHistoryNameInput: model.editHistoryNameInput,
          selectedHistorySession: detail,
        },
        h,
      ),
    ],
  );
};
