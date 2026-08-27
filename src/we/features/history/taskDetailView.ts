import { svgIcon } from "../../ui";
import type { HtmlBuilder } from "foldkit/html";
import { Message } from "../../../messages";
import { formatDurationHm, formatTimestamp } from "../../format";

type TaskDetailModel = {
  readonly task: {
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
};

const badge = (taskId: number, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0",
      ),
      h.Attribute("style", "min-width:24px;min-height:24px"),
    ],
    [String(taskId)],
  );

const playIcon = (h: HtmlBuilder<Message>) =>
  svgIcon("h-4 w-4 text-base-content/50 shrink-0", h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.polyline([h.Attribute("points", "12 7 12 12 15.5 13.5")], []),
  ]);
const stopIcon = (h: HtmlBuilder<Message>) =>
  svgIcon("h-4 w-4 text-base-content/50 shrink-0", h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.rect(
      [
        h.Attribute("x", "9"),
        h.Attribute("y", "9"),
        h.Attribute("width", "6"),
        h.Attribute("height", "6"),
        h.Attribute("rx", "1"),
      ],
      [],
    ),
  ]);
const clockIcon = (h: HtmlBuilder<Message>) =>
  svgIcon("h-4 w-4 text-base-content/50 shrink-0", h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.polyline([h.Attribute("points", "12 7 12 12 15.5 13.5")], []),
  ]);

const checkIcon = (h: HtmlBuilder<Message>) =>
  svgIcon("h-3.5 w-3.5 text-success shrink-0", h, [
    h.path(
      [
        h.Attribute(
          "d",
          "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.3 7.3-5 5a1 1 0 0 1-1.4 0l-2-2 1.4-1.4 1.3 1.3 4.3-4.3z",
        ),
      ],
      [],
    ),
  ]);

export const taskDetailView = (model: TaskDetailModel, h: HtmlBuilder<Message>) => {
  const task = model.task;
  const duration =
    task.startedAt !== null && task.endedAt !== null
      ? formatDurationHm(task.endedAt - task.startedAt)
      : null;

  return h.div(
    [
      h.Class("fixed inset-0 z-50 flex flex-col bg-base-200"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
    ],
    [
      h.div(
        [
          h.Class(
            "flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-3 pt-[calc(0.5rem+env(safe-area-inset-top))] shrink-0",
          ),
        ],
        [
          h.div([h.Class("w-16")], []),
          h.h2([h.Class("text-base font-semibold text-center")], ["Task Details"]),
          h.button(
            [
              h.Class("btn btn-ghost btn-sm rounded-field min-w-16 justify-end"),
              h.OnClick(Message.DismissedHistoryTask()),
            ],
            ["Done"],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            "flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-4 pb-[env(safe-area-inset-bottom)]",
          ),
        ],
        [
          // Header badge + title
          h.div(
            [h.Class("flex items-center gap-3 px-1 py-2")],
            [
              badge(task.taskId, h),
              h.h3([h.Class("text-base font-semibold")], [`Task ${task.taskId}`]),
            ],
          ),
          // Metadata rows
          h.div(
            [
              h.Class(
                "rounded-box bg-base-100 border border-base-300 divide-y divide-base-200 overflow-hidden",
              ),
            ],
            [
              ...(task.startedAt !== null
                ? [
                    h.div(
                      [h.Class("flex items-center gap-3 px-4 py-3")],
                      [
                        playIcon(h),
                        h.span([h.Class("text-sm flex-1")], ["Started"]),
                        h.span(
                          [h.Class("text-sm text-base-content/70")],
                          [formatTimestamp(task.startedAt)],
                        ),
                      ],
                    ),
                  ]
                : []),
              ...(task.endedAt !== null
                ? [
                    h.div(
                      [h.Class("flex items-center gap-3 px-4 py-3")],
                      [
                        stopIcon(h),
                        h.span([h.Class("text-sm flex-1")], ["Ended"]),
                        h.span(
                          [h.Class("text-sm text-base-content/70")],
                          [formatTimestamp(task.endedAt)],
                        ),
                      ],
                    ),
                  ]
                : []),
              ...(duration !== null
                ? [
                    h.div(
                      [h.Class("flex items-center gap-3 px-4 py-3")],
                      [
                        clockIcon(h),
                        h.span([h.Class("text-sm flex-1 font-medium")], ["Duration"]),
                        h.span([h.Class("text-sm text-base-content/70 font-medium")], [duration]),
                      ],
                    ),
                  ]
                : []),
            ],
          ),
          // Recorded Data
          h.div(
            [h.Class("rounded-box bg-base-100 border border-base-300 overflow-hidden shadow-xs")],
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
                    ["Recorded Data"],
                  ),
                ],
              ),
              ...(task.sections.length === 0
                ? [
                    h.div(
                      [h.Class("px-4 py-6 text-center text-sm italic text-base-content/50")],
                      ["No data recorded."],
                    ),
                  ]
                : task.sections.map((section) => {
                    const val = section.value.trim().toLowerCase();
                    const isBool = val === "true" || val === "false";
                    const isBoolOn = val === "true";
                    const hasValue = section.value !== "";
                    const showCheck = isBool ? isBoolOn : hasValue;

                    return h.div(
                      [h.Class("px-4 py-3 border-b border-base-200 last:border-b-0")],
                      [
                        h.div(
                          [h.Class("flex items-center gap-1.5")],
                          [
                            h.span(
                              [h.Class("text-sm font-medium text-base-content/70")],
                              [section.sectionName],
                            ),
                            ...(section.isRequired
                              ? [h.span([h.Class("text-error text-sm font-bold")], ["*"])]
                              : []),
                            h.div([h.Class("flex-1")], []),
                            ...(showCheck ? [checkIcon(h)] : []),
                          ],
                        ),
                        h.div(
                          [h.Class("mt-1.5")],
                          [
                            isBool
                              ? isBoolOn
                                ? h.span(
                                    [
                                      h.Class(
                                        "badge badge-success text-white badge-sm font-semibold",
                                      ),
                                    ],
                                    ["Yes"],
                                  )
                                : h.span(
                                    [
                                      h.Class(
                                        "badge badge-ghost badge-sm text-base-content/70 font-medium",
                                      ),
                                    ],
                                    ["No"],
                                  )
                              : hasValue
                                ? h.span(
                                    [h.Class("text-sm text-base-content leading-relaxed")],
                                    [section.value],
                                  )
                                : h.span([h.Class("text-sm italic text-base-content/40")], ["—"]),
                          ],
                        ),
                      ],
                    );
                  })),
            ],
          ),
        ],
      ),
    ],
  );
};
