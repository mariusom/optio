import { svgIcon } from "../../ui";
import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import { formatDurationHm, formatTimestamp } from "../../format";
import type { TemplateSummary } from "../../types";
import type { ActiveSession } from "./startHelpers";
import { displaySessionName, isTemplateMissing } from "./startHelpers";

// ── Icons ──────────────────────────────────────────────────────────────────

const tagIcon = <M>(classes: string, h: HtmlBuilder<M>) =>
  svgIcon(classes, h, [
    h.path(
      [
        h.Attribute(
          "d",
          "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z",
        ),
      ],
      [],
    ),
    h.line(
      [
        h.Attribute("x1", "7"),
        h.Attribute("y1", "7"),
        h.Attribute("x2", "7.01"),
        h.Attribute("y2", "7"),
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

  const title = missing ? "Template Missing" : "Active Session In Progress";

  const infoRows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "Session Name", value: nameDisplay },
    { label: "Template", value: active.templateName },
    { label: "Started At", value: startedLabel, mono: true },
    { label: "Elapsed Time", value: durationLabel, mono: true },
    { label: "Tasks Recorded", value: `${active.completedCount} completed`, mono: true },
  ];

  return h.div(
    [h.Class("w-full max-w-xl mx-auto space-y-4")],
    [
      h.div(
        [
          h.Class(
            "rounded-box bg-base-100 border border-base-300 shadow-sm overflow-hidden backdrop-blur-md",
          ),
        ],
        [
          // Header with pulsing status
          h.div(
            [
              h.Class(
                `flex items-center justify-between px-5 py-4 border-b ${
                  missing ? "bg-error/10 border-error/20" : "bg-warning/10 border-warning/20"
                }`,
              ),
            ],
            [
              h.div(
                [h.Class("flex items-center gap-3")],
                [
                  h.div(
                    [
                      h.Class(
                        `h-3 w-3 rounded-full shrink-0 ${
                          missing ? "bg-error" : "bg-warning animate-pulse"
                        }`,
                      ),
                      h.Attribute("aria-hidden", "true"),
                    ],
                    [],
                  ),
                  h.span(
                    [
                      h.Class(
                        `text-base font-bold ${missing ? "text-error" : "text-base-content"}`,
                      ),
                    ],
                    [title],
                  ),
                ],
              ),
              h.span(
                [h.Class("badge badge-sm badge-neutral font-mono text-xs")],
                [`${active.completedCount} tasks`],
              ),
            ],
          ),
          // Rows
          h.div(
            [h.Class("divide-y divide-base-200")],
            infoRows.map((row) =>
              h.div(
                [h.Class("flex items-center justify-between px-5 py-3.5 text-sm")],
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
                    [
                      h.Class(
                        `text-sm font-semibold text-base-content truncate ml-4 ${
                          row.mono ? "font-mono" : ""
                        }`,
                      ),
                    ],
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
                  [h.Class("px-5 py-3.5 bg-warning/10 border-t border-warning/20")],
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
            [h.Class("flex gap-3 px-5 py-4 border-t border-base-200 bg-base-200/30")],
            [
              h.button(
                [
                  h.Class(
                    "btn btn-outline btn-error flex-1 rounded-field gap-2 text-sm font-semibold border-error/30 hover:bg-error hover:text-white active:scale-[0.98] transition-all",
                  ),
                  h.OnClick(Message.ClickedDiscardSession()),
                  h.AriaLabel("Discard Session"),
                ],
                [trashIcon("h-4 w-4", h), "Discard Session"],
              ),
              h.button(
                [
                  h.Class(
                    "btn btn-primary flex-1 rounded-field gap-2 text-sm font-semibold shadow-sm active:scale-[0.98] transition-all",
                  ),
                  h.OnClick(Message.ClickedResumeSession()),
                  h.AriaLabel(missing ? "Finish Session" : "Resume Session"),
                ],
                [
                  missing ? checkIcon("h-4 w-4", h) : playIcon("h-4 w-4", h),
                  missing ? "Finish Session" : "Resume Session",
                ],
              ),
            ],
          ),
        ],
      ),
      ...(pendingDiscard ? [discardModal(h)] : []),
    ],
  );
};

const discardModal = (h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
      h.AriaLabel("Discard Session Confirmation"),
    ],
    [
      h.div(
        [
          h.Class(
            "modal-box max-w-sm rounded-box border border-base-300 bg-base-100 p-5 shadow-xl",
          ),
        ],
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
  h.div(
    [h.Class("w-full max-w-lg mx-auto")],
    [
      h.div(
        [
          h.Class(
            "rounded-box bg-base-100 border border-base-300 shadow-xs p-6 sm:p-8 text-center flex flex-col items-center",
          ),
        ],
        [
          h.div(
            [
              h.Class(
                "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs",
              ),
            ],
            [docIcon("h-8 w-8", h)],
          ),
          h.h3([h.Class("text-lg font-bold text-base-content")], ["No Templates Configured"]),
          h.p(
            [h.Class("mt-2 text-xs sm:text-sm leading-relaxed text-base-content/60 max-w-sm")],
            [
              "Create a template to define the form schema, field types, and questions captured during your time and motion studies.",
            ],
          ),
          h.a(
            [
              h.Class(
                "btn btn-primary mt-6 rounded-field gap-2 text-sm font-semibold shadow-sm active:scale-[0.98] transition-all px-8",
              ),
              h.Attribute("href", "#/templates"),
              h.AriaLabel("Create Template"),
            ],
            [h.span([h.Class("text-lg leading-none")], ["+"]), "Create Your First Template"],
          ),
        ],
      ),
    ],
  );

// ── Start Form Controls ────────────────────────────────────────────────────

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
    [h.Class("dropdown dropdown-bottom w-full")],
    [
      h.div(
        [
          h.Tabindex(0),
          h.Class(
            "btn w-full justify-between rounded-field border border-base-300 bg-base-100 text-sm font-medium normal-case hover:bg-base-200/50 hover:border-base-300/80 focus-visible:border-primary transition-all h-12 shadow-2xs",
          ),
          h.Attribute("role", "combobox"),
          h.Attribute("aria-expanded", "false"),
          h.Attribute("aria-haspopup", "listbox"),
          h.AriaLabel("Select Template"),
        ],
        [
          h.div(
            [h.Class("flex items-center gap-2.5 truncate")],
            [
              docIcon("h-4 w-4 text-primary shrink-0", h),
              h.span([h.Class("truncate text-left font-semibold text-base-content")], [label]),
            ],
          ),
          chevronIcon("h-4 w-4 text-base-content/50 shrink-0", h),
        ],
      ),
      h.ul(
        [
          h.Tabindex(0),
          h.Class(
            "dropdown-content menu z-40 mt-1 max-h-64 w-full overflow-auto rounded-box border border-base-300 bg-base-100 p-1.5 shadow-xl",
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
                      h.span([h.Class("truncate font-medium")], [nameWithSuffix]),
                      h.span(
                        [h.Class("text-[11px] text-base-content/50 font-normal mt-0.5")],
                        [`${t.fieldCount} fields · ${t.requiredCount} required`],
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
      h.div(
        [h.Class("flex items-center justify-between")],
        [
          h.legend(
            [
              h.Class(
                "fieldset-legend text-xs font-semibold uppercase tracking-wider text-base-content/70",
              ),
            ],
            ["Session Name (Optional)"],
          ),
          h.span([h.Class("text-[11px] text-base-content/40 font-mono")], ["Auto-timestamped"]),
        ],
      ),
      // DaisyUI 5 Input Group container with leading icon, text input, and inline clear button
      h.label(
        [
          h.Class(
            "input input-bordered flex items-center gap-2.5 w-full h-12 rounded-field bg-base-100 focus-within:input-primary transition-all shadow-2xs cursor-text",
          ),
        ],
        [
          tagIcon("h-4 w-4 text-base-content/40 shrink-0", h),
          h.input([
            h.Class(
              "grow bg-transparent text-base md:text-sm focus:outline-none placeholder:text-base-content/40 h-full",
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
                      "btn btn-ghost btn-circle btn-xs text-base-content/40 hover:text-base-content hover:bg-base-200 transition-colors shrink-0",
                    ),
                    h.OnClick(Message.ChangedSessionNameInput({ text: "" })),
                    h.AriaLabel("Clear session name"),
                  ],
                  [xIcon("h-3.5 w-3.5", h)],
                ),
              ]
            : []),
        ],
      ),
    ],
  );

// ── Start Form Launcher Card ───────────────────────────────────────────────

const startFormCard = (
  templates: ReadonlyArray<TemplateSummary>,
  selectedTemplateId: string | null,
  placeholderName: string,
  sessionNameInput: string,
  h: HtmlBuilder<Message>,
) => {
  const canStart =
    selectedTemplateId !== null && templates.some((t) => t.id === selectedTemplateId);

  return h.div(
    [
      h.Class(
        "rounded-box bg-base-100 border border-base-300 shadow-sm overflow-hidden backdrop-blur-md w-full",
      ),
    ],
    [
      // Card Header with Local-First tag
      h.div(
        [
          h.Class(
            "flex items-center justify-between px-5 py-3.5 bg-base-200/50 border-b border-base-200",
          ),
        ],
        [
          h.div(
            [h.Class("flex items-center gap-2")],
            [
              h.div(
                [
                  h.Class(
                    "flex h-6 w-6 items-center justify-center rounded-md bg-primary text-white text-xs",
                  ),
                ],
                [playIcon("h-3 w-3", h)],
              ),
              h.h2([h.Class("text-sm font-bold text-base-content")], ["Launch Study Session"]),
            ],
          ),
          // Tag moved to the card
          h.div(
            [
              h.Class(
                "inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-2.5 py-0.5 text-[11px] font-medium text-base-content/80 shadow-2xs font-mono select-none",
              ),
            ],
            [
              h.div([h.Class("h-1.5 w-1.5 rounded-full bg-success")], []),
              h.span([], ["Local-First · OPFS SQLite"]),
            ],
          ),
        ],
      ),

      // Card Body
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
                ["Study Template"],
              ),
              templatePicker(templates, selectedTemplateId, h),
            ],
          ),
          sessionNameField(placeholderName, sessionNameInput, h),
          h.button(
            [
              h.Class(
                "btn btn-primary btn-block rounded-field h-13 text-base font-semibold shadow-md shadow-primary/20 gap-2.5 active:scale-[0.98] transition-all disabled:opacity-50 hover:brightness-105",
              ),
              h.Disabled(!canStart),
              h.OnClick(Message.ClickedStartSession()),
              h.AriaLabel("Start Session"),
            ],
            [playIcon("h-4 w-4", h), h.span([], ["Start Study Session"])],
          ),
        ],
      ),
    ],
  );
};

// ── Hero Branding Header ───────────────────────────────────────────────────

const heroHeader = (h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("flex flex-col items-center text-center gap-2.5")],
    [
      // App logo mark + Title
      h.div(
        [h.Class("flex items-center gap-3")],
        [
          h.div(
            [
              h.Class(
                "flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white font-serif text-2xl sm:text-3xl shadow-sm select-none shrink-0",
              ),
            ],
            ["θ"],
          ),
          h.div(
            [h.Class("flex flex-col text-left")],
            [
              h.h1(
                [
                  h.Class(
                    "text-2xl sm:text-3xl font-bold tracking-tight text-base-content leading-none",
                  ),
                ],
                ["optio"],
              ),
              h.span(
                [h.Class("text-xs sm:text-sm font-medium text-primary mt-1 tracking-tight")],
                ["Time & Motion Study Recorder"],
              ),
            ],
          ),
        ],
      ),
      h.p(
        [h.Class("text-xs sm:text-sm leading-relaxed text-base-content/70 max-w-sm mt-0.5")],
        [
          "Sub-second task timing designed for industrial engineering, healthcare observations, and continuous workflow studies.",
        ],
      ),
    ],
  );

const featureHighlights = (h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("flex flex-wrap items-center justify-center gap-2 pt-1 text-center")],
    [
      h.div(
        [
          h.Class(
            "badge badge-outline border-base-300 bg-base-100/70 text-[11px] text-base-content/70 py-2.5 px-3 shadow-2xs gap-1.5",
          ),
        ],
        [h.span([h.Class("text-primary font-bold")], ["⏱"]), "Sub-Second Precision"],
      ),
      h.div(
        [
          h.Class(
            "badge badge-outline border-base-300 bg-base-100/70 text-[11px] text-base-content/70 py-2.5 px-3 shadow-2xs gap-1.5",
          ),
        ],
        [h.span([h.Class("text-primary font-bold")], ["🎛"]), "Dynamic Schemas"],
      ),
      h.div(
        [
          h.Class(
            "badge badge-outline border-base-300 bg-base-100/70 text-[11px] text-base-content/70 py-2.5 px-3 shadow-2xs gap-1.5",
          ),
        ],
        [h.span([h.Class("text-primary font-bold")], ["🔒"]), "100% Offline & Private"],
      ),
    ],
  );

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

  return h.div(
    [
      h.Class(
        "min-h-full flex flex-col items-center justify-center py-6 sm:py-10 px-4 sm:px-6 max-w-xl mx-auto w-full pb-[calc(4.5rem+env(safe-area-inset-bottom))]",
      ),
    ],
    [
      hasActive
        ? h.div(
            [h.Class("space-y-6 w-full my-auto")],
            [
              heroHeader(h),
              resumeView(
                model.activeSession as ActiveSession,
                model.templates,
                model.pendingDiscardSession,
                h,
              ),
            ],
          )
        : model.templates.length === 0
          ? h.div([h.Class("space-y-6 w-full my-auto")], [heroHeader(h), noTemplatesView(h)])
          : h.div(
              [h.Class("space-y-6 w-full my-auto flex flex-col items-center")],
              [
                heroHeader(h),
                startFormCard(
                  model.templates,
                  model.selectedTemplateId,
                  model.placeholderName,
                  model.sessionNameInput,
                  h,
                ),
                featureHighlights(h),
              ],
            ),
    ],
  );
};
