import { svgIcon } from "../../ui";
import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import { formatDurationHm, formatTimestamp } from "../../format";
import type { TemplateSummary } from "../../types";
import type { ActiveSession } from "./startHelpers";
import { displaySessionName, isTemplateMissing } from "./startHelpers";

// Icons — small SVGs mirrored from we/ui icon set (generic SVGs; SF Symbols-accurate variants deferred to S7 polish)
const clockIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
    h.polyline([h.Attribute("points", "12 7 12 12 15.5 13.5")], []),
  ]);

const triangleIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.path(
      [
        h.Attribute(
          "d",
          "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
        ),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "12"),
        h.Attribute("y1", "9"),
        h.Attribute("x2", "12"),
        h.Attribute("y2", "13"),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "12"),
        h.Attribute("y1", "17"),
        h.Attribute("x2", "12.01"),
        h.Attribute("y2", "17"),
      ],
      [],
    ),
  ]);

const playIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [h.polygon([h.Attribute("points", "5 3 19 12 5 21 5 3")], [])]);

const checkIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.path([h.Attribute("d", "M22 11.08V12a10 10 0 1 1-5.93-9.14")], []),
    h.polyline([h.Attribute("points", "22 4 12 14.01 9 11.01")], []),
  ]);

const docIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.path([h.Attribute("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z")], []),
    h.polyline([h.Attribute("points", "14 2 14 8 20 8")], []),
    h.line(
      [
        h.Attribute("x1", "16"),
        h.Attribute("y1", "13"),
        h.Attribute("x2", "8"),
        h.Attribute("y2", "13"),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "16"),
        h.Attribute("y1", "17"),
        h.Attribute("x2", "8"),
        h.Attribute("y2", "17"),
      ],
      [],
    ),
  ]);

const xIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.line(
      [
        h.Attribute("x1", "18"),
        h.Attribute("y1", "6"),
        h.Attribute("x2", "6"),
        h.Attribute("y2", "18"),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "6"),
        h.Attribute("y1", "6"),
        h.Attribute("x2", "18"),
        h.Attribute("y2", "18"),
      ],
      [],
    ),
  ]);

const chevronIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [h.polyline([h.Attribute("points", "6 9 12 15 18 9")], [])]);

const checkSmallIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [h.polyline([h.Attribute("points", "20 6 9 17 4 12")], [])], "3");

const trashIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
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
  ]);

// ── BottomToolbar chrome wrapper ──────────────────────────────────────────
// Gradient + safe-area aware container per spec §BottomToolbarView

const bottomToolbarChrome = <M>(children: ReturnType<HtmlBuilder<M>["div"]>[], h: HtmlBuilder<M>) =>
  h.div(
    [
      h.Class(
        "relative w-full py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4 sm:px-6 lg:px-8",
      ),
    ],
    [
      h.div(
        [
          h.Class(
            "mx-auto w-full max-w-[440px] md:max-w-[480px] rounded-box bg-base-100 border border-base-300 shadow-md overflow-hidden",
          ),
        ],
        children,
      ),
    ],
  );

const bottomToolbarChromeNoCard = <M>(
  children: ReturnType<HtmlBuilder<M>["div"]>[],
  h: HtmlBuilder<M>,
) =>
  h.div(
    [
      h.Class(
        "relative w-full py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] px-4 sm:px-6 lg:px-8",
      ),
    ],
    [h.div([h.Class("mx-auto w-full max-w-[440px] md:max-w-[480px]")], children)],
  );

// ── ResumeSessionView ─────────────────────────────────────────────────────

const resumeView = (
  active: ActiveSession,
  templates: ReadonlyArray<TemplateSummary>,
  pendingDiscard: boolean,
  h: HtmlBuilder<Message>,
) => {
  const missing = isTemplateMissing(templates, active);
  const nameDisplay = displaySessionName(active.sessionName, active.templateName);
  const startedLabel = formatTimestamp(active.startedAt);
  const durationLabel = formatDurationHm(Date.now() - active.startedAt);

  const title = missing ? "Template Missing" : "Session In Progress";

  const infoRows: Array<{ label: string; value: string }> = [
    { label: "Name", value: nameDisplay },
    { label: "Template", value: active.templateName },
    { label: "Started", value: startedLabel },
    { label: "Duration", value: durationLabel },
    { label: "Tasks", value: `${active.completedCount} completed` },
  ];

  return bottomToolbarChromeNoCard(
    [
      h.div(
        [
          h.Class(
            "rounded-box bg-base-100 border border-base-300 shadow-md overflow-hidden backdrop-blur-md",
          ),
        ],
        [
          // Header
          h.div(
            [h.Class("flex items-center gap-2.5 px-5 py-3.5 bg-base-100 border-b border-base-200")],
            [
              missing
                ? triangleIcon("h-5 w-5 text-error shrink-0", h)
                : clockIcon("h-5 w-5 text-warning shrink-0", h),
              h.span(
                [h.Class(`text-sm font-bold ${missing ? "text-error" : "text-base-content"}`)],
                [title],
              ),
            ],
          ),
          // Rows
          h.div(
            [h.Class("divide-y divide-base-200")],
            infoRows.map((row) =>
              h.div(
                [h.Class("flex items-center justify-between px-5 py-3 text-sm")],
                [
                  h.span(
                    [
                      h.Class(
                        "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                      ),
                    ],
                    [row.label],
                  ),
                  h.span(
                    [h.Class("text-sm font-medium text-base-content truncate ml-3")],
                    [row.value],
                  ),
                ],
              ),
            ),
          ),
          // Missing warning
          ...(missing
            ? [
                h.div(
                  [h.Class("px-5 py-3 bg-warning/10 border-t border-warning/20")],
                  [
                    h.p(
                      [h.Class("text-xs leading-relaxed text-warning-content/90")],
                      [
                        "The template for this session is no longer available. You can finish the session to save existing tasks, or discard it.",
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          // Buttons
          h.div(
            [h.Class("flex gap-3 px-5 py-3.5 border-t border-base-200 bg-base-100/50")],
            [
              h.button(
                [
                  h.Class(
                    "btn btn-outline btn-error flex-1 rounded-field gap-1.5 text-sm font-medium border-error/40 hover:bg-error hover:text-error-content active:scale-[0.98]",
                  ),
                  h.OnClick(Message.ClickedDiscardSession()),
                  h.AriaLabel("Discard Session"),
                ],
                [trashIcon("h-4 w-4", h), "Discard"],
              ),
              h.button(
                [
                  h.Class(
                    "btn btn-primary flex-1 rounded-field gap-1.5 text-sm font-semibold shadow-sm active:scale-[0.98]",
                  ),
                  h.OnClick(Message.ClickedResumeSession()),
                  h.AriaLabel(missing ? "Finish Session" : "Resume Session"),
                ],
                [
                  missing ? checkIcon("h-4 w-4", h) : playIcon("h-4 w-4", h),
                  missing ? "Finish" : "Resume",
                ],
              ),
            ],
          ),
        ],
      ),
      ...(pendingDiscard ? [discardModal(h)] : []),
    ],
    h,
  );
};

const discardModal = (h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
      h.AriaLabel("Discard Session"),
    ],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 bg-base-100 p-5")],
        [
          h.h3([h.Class("text-base font-bold text-base-content")], ["Discard Session?"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")],
            [
              "This will permanently delete the in-progress session and all recorded tasks. This action cannot be undone.",
            ],
          ),
          h.div(
            [h.Class("modal-action mt-5 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedDiscardSession()),
                  h.AriaLabel("Confirm discard session"),
                ],
                ["Discard"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledDiscardSession()),
                  h.AriaLabel("Cancel discard"),
                ],
                ["Cancel"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledDiscardSession())], []),
    ],
  );

// ── NoTemplatesView ───────────────────────────────────────────────────────

const noTemplatesView = (h: HtmlBuilder<Message>) =>
  bottomToolbarChrome(
    [
      h.div(
        [h.Class("flex flex-col items-center p-6 sm:p-8 text-center")],
        [
          h.div(
            [
              h.Class(
                "mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-base-300/60 text-base-content/50 shadow-xs",
              ),
            ],
            [docIcon("h-7 w-7", h)],
          ),
          h.h3([h.Class("text-base font-bold text-base-content")], ["No Templates"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/60 max-w-xs")],
            ["Create a template to define the fields for your time and motion study sessions."],
          ),
          h.a(
            [
              h.Class(
                "btn btn-primary mt-6 rounded-field gap-2 text-sm font-semibold shadow-sm active:scale-[0.98] transition-all px-6",
              ),
              h.Attribute("href", "#/templates"),
              h.AriaLabel("Create Template"),
            ],
            [h.span([h.Class("text-lg leading-none")], ["+"]), "Create Template"],
          ),
        ],
      ),
    ],
    h,
  );

// ── Start form ────────────────────────────────────────────────────────────

const templatePicker = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedId: string | null,
  h: HtmlBuilder<Message>,
) => {
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
  const selected = sorted.find((t) => t.id === selectedId) ?? null;
  const label =
    selected !== null
      ? `${selected.name}${selected.isDefault ? " (Default)" : ""}`
      : "Select Template";

  return h.div(
    [h.Class("dropdown dropdown-top w-full")],
    [
      h.div(
        [
          h.Tabindex(0),
          h.Class(
            "btn w-full justify-between rounded-field border border-base-300 bg-base-100 text-sm font-medium normal-case hover:bg-base-200/50 hover:border-base-300/80 focus-visible:border-primary transition-all",
          ),
          h.Attribute("role", "combobox"),
          h.Attribute("aria-expanded", "false"),
          h.Attribute("aria-haspopup", "listbox"),
          h.AriaLabel("Select Template"),
        ],
        [
          h.span([h.Class("truncate text-left")], [label]),
          chevronIcon("h-4 w-4 text-base-content/50 shrink-0", h),
        ],
      ),
      h.ul(
        [
          h.Tabindex(0),
          h.Class(
            "dropdown-content menu z-40 mb-1 max-h-60 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-1.5 shadow-xl",
          ),
          h.Attribute("role", "listbox"),
          h.AriaLabel("Templates list"),
        ],
        sorted.map((t) => {
          const isSelected = t.id === selectedId;
          const nameWithSuffix = `${t.name}${t.isDefault ? " (Default)" : ""}`;
          return h.li(
            [h.Attribute("role", "none")],
            [
              h.button(
                [
                  h.Class(
                    `flex w-full items-center justify-between rounded-field px-3.5 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-base-content hover:bg-base-200/60"
                    }`,
                  ),
                  h.Attribute("role", "option"),
                  h.Attribute("aria-selected", isSelected ? "true" : "false"),
                  h.AriaLabel(nameWithSuffix),
                  h.OnClick(Message.SelectedTemplate({ id: t.id })),
                ],
                [
                  h.div(
                    [h.Class("flex flex-col min-w-0 pr-2")],
                    [
                      h.span([h.Class("truncate")], [nameWithSuffix]),
                      h.span(
                        [h.Class("text-[11px] text-base-content/50 font-normal mt-0.5")],
                        [`${t.fieldCount} fields`],
                      ),
                    ],
                  ),
                  ...(isSelected ? [checkSmallIcon("h-4 w-4 text-primary shrink-0", h)] : []),
                ],
              ),
            ],
          );
        }),
      ),
    ],
  );
};

const sessionNameField = (
  placeholderName: string,
  sessionNameInput: string,
  h: HtmlBuilder<Message>,
) =>
  h.fieldset(
    [h.Class("fieldset p-0 gap-1.5 w-full")],
    [
      h.legend(
        [
          h.Class(
            "fieldset-legend text-xs font-semibold uppercase tracking-wider text-base-content/70",
          ),
        ],
        ["Session Name"],
      ),
      h.input([
        h.Class(
          "input input-bordered w-full rounded-field text-base md:text-sm bg-base-100 focus-visible:input-primary focus-visible:outline-none transition-colors placeholder:text-base-content/40",
        ),
        h.Value(sessionNameInput),
        h.Placeholder(placeholderName),
        h.AriaLabel("Session Name"),
        h.OnInput((value) => Message.ChangedSessionNameInput({ text: value })),
        h.OnKeyDownPreventDefault((key) =>
          key === "Enter" ? Option.some(Message.ClickedStartSession()) : Option.none(),
        ),
      ]),
      ...(sessionNameInput.length > 0
        ? [
            h.button(
              [
                h.Class(
                  "btn btn-ghost btn-xs self-start gap-1 text-base-content/60 hover:text-base-content px-1.5 h-6 min-h-0 rounded-field",
                ),
                h.OnClick(Message.ChangedSessionNameInput({ text: "" })),
                h.AriaLabel("Clear session name"),
              ],
              [xIcon("h-3 w-3", h), "Clear"],
            ),
          ]
        : []),
    ],
  );

const startFormView = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedTemplateId: string | null,
  placeholderName: string,
  sessionNameInput: string,
  h: HtmlBuilder<Message>,
) => {
  const canStart =
    selectedTemplateId !== null && templates.some((t) => t.id === selectedTemplateId);
  return bottomToolbarChrome(
    [
      h.div(
        [h.Class("p-5 sm:p-6 space-y-5")],
        [
          h.fieldset(
            [h.Class("fieldset p-0 gap-1.5 w-full")],
            [
              h.legend(
                [
                  h.Class(
                    "fieldset-legend text-xs font-semibold uppercase tracking-wider text-base-content/70",
                  ),
                ],
                ["Template"],
              ),
              templatePicker(templates, selectedTemplateId, h),
            ],
          ),
          sessionNameField(placeholderName, sessionNameInput, h),
          h.button(
            [
              h.Class(
                "btn btn-primary btn-block rounded-field h-12 text-sm font-semibold shadow-sm gap-2 active:scale-[0.98] transition-all disabled:opacity-50",
              ),
              h.Disabled(!canStart),
              h.OnClick(Message.ClickedStartSession()),
              h.AriaLabel("Start Session"),
            ],
            [playIcon("h-4 w-4", h), "Start Session"],
          ),
        ],
      ),
    ],
    h,
  );
};

// ── Public entry ──────────────────────────────────────────────────────────

type StartModel = {
  readonly templates: ReadonlyArray<TemplateSummary>;
  readonly selectedTemplateId: string | null;
  readonly sessionNameInput: string;
  readonly placeholderName: string;
  readonly activeSession: ActiveSession | null;
  readonly pendingDiscardSession: boolean;
};

export const startView = (model: StartModel, h: HtmlBuilder<Message>) => {
  const hasActive = model.activeSession !== null;
  if (hasActive) {
    return h.div(
      [h.Class("flex h-full flex-col")],
      [
        // Centered logo
        h.div(
          [h.Class("flex flex-1 flex-col items-center justify-center px-6 text-center")],
          [
            h.div(
              [
                h.Class(
                  "flex h-[150px] w-[150px] items-center justify-center rounded-[30px] bg-primary/10 text-5xl font-serif text-primary shadow-md select-none",
                ),
              ],
              ["θ"],
            ),
            h.p([h.Class("mt-4 text-lg font-semibold tracking-tight")], ["optio"]),
            h.p(
              [h.Class("mt-1 max-w-xs text-sm leading-relaxed text-base-content/60")],
              ["Time & motion studies — recorded locally, never leaving your device."],
            ),
          ],
        ),
        resumeView(
          model.activeSession as ActiveSession,
          model.templates,
          model.pendingDiscardSession,
          h,
        ),
      ],
    );
  }

  if (model.templates.length === 0) {
    return h.div(
      [h.Class("flex h-full flex-col")],
      [
        h.div(
          [h.Class("flex flex-1 flex-col items-center justify-center px-6 text-center")],
          [
            h.div(
              [
                h.Class(
                  "flex h-[150px] w-[150px] items-center justify-center rounded-[30px] bg-primary/10 text-5xl font-serif text-primary shadow-md select-none",
                ),
              ],
              ["θ"],
            ),
            h.p([h.Class("mt-4 text-lg font-semibold tracking-tight")], ["optio"]),
            h.p(
              [h.Class("mt-1 max-w-xs text-sm leading-relaxed text-base-content/60")],
              ["Time & motion studies — recorded locally, never leaving your device."],
            ),
          ],
        ),
        noTemplatesView(h),
      ],
    );
  }

  return h.div(
    [h.Class("flex h-full flex-col")],
    [
      h.div(
        [h.Class("flex flex-1 flex-col items-center justify-center px-6 text-center")],
        [
          h.div(
            [
              h.Class(
                "flex h-[150px] w-[150px] items-center justify-center rounded-[30px] bg-primary/10 text-5xl font-serif text-primary shadow-md select-none",
              ),
            ],
            ["θ"],
          ),
          h.p([h.Class("mt-4 text-lg font-semibold tracking-tight")], ["optio"]),
          h.p(
            [h.Class("mt-1 max-w-xs text-sm leading-relaxed text-base-content/60")],
            ["Time & motion studies — recorded locally, never leaving your device."],
          ),
        ],
      ),
      startFormView(
        model.templates,
        model.selectedTemplateId,
        model.placeholderName,
        model.sessionNameInput,
        h,
      ),
    ],
  );
};
