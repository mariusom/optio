import { svgIcon } from "../../ui";
import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { button } from "@/components/ui/button";
import { nativeSelect } from "@/components/ui/native-select";
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
          h.h3([h.Class("text-lg font-bold text-base-content")], ["Your first study starts here"]),
          h.p(
            [h.Class("mt-2 text-xs sm:text-sm leading-relaxed text-base-content/60 max-w-sm")],
            [
              "Create a template for the details you want to capture, then begin your first session.",
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
  return nativeSelect(
    {
      id: "study-template",
      label: "Study template",
      labelClass: "text-sm font-semibold text-foreground",
      value: selectedId ?? "",
      onChange: (id) => Message.SelectedTemplate({ id }),
      options: [
        ...(selectedId === null
          ? [h.option([h.Value(""), h.Disabled(true)], ["Select template"])]
          : []),
        ...sorted.map((template) =>
          h.option(
            [h.Value(template.id)],
            [`${template.name}${template.isDefault ? " (Default)" : ""}`],
          ),
        ),
      ],
    },
    h,
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
        ["Session name (optional)"],
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
        "launch-card rounded-box bg-base-100 border border-base-300 shadow-sm overflow-hidden backdrop-blur-md w-full",
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
                    "flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs",
                  ),
                ],
                [playIcon("h-3 w-3", h)],
              ),
              h.h2([h.Class("text-sm font-bold text-base-content")], ["New session"]),
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
              h.span([], ["On-device"]),
            ],
          ),
        ],
      ),

      // Card Body
      h.div(
        [h.Class("p-5 sm:p-6 space-y-5")],
        [
          templatePicker(templates, selectedTemplateId, h),
          sessionNameField(placeholderName, sessionNameInput, h),
          button(
            {
              className: "w-full rounded-field gap-2.5 text-base font-semibold",
              isDisabled: !canStart,
              onClick: Message.ClickedStartSession(),
              attributes: [h.AriaLabel("Start Session")],
            },
            [playIcon("h-4 w-4", h), h.span([], ["Start session"])],
            h,
          ),
        ],
      ),
    ],
  );
};

// ── Hero Branding Header ───────────────────────────────────────────────────

const heroHeader = (h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("start-intro")],
    [
      h.p(
        [h.Class("text-xs font-semibold uppercase tracking-widest text-primary")],
        ["YOUR WORKSPACE"],
      ),
      h.h1(
        [h.Class("start-title text-4xl sm:text-5xl font-bold tracking-tight text-base-content")],
        ["Make every moment count."],
      ),
      h.p(
        [h.Class("text-sm sm:text-base leading-relaxed text-base-content/70")],
        ["Choose a template, start observing, and turn everyday work into useful insights."],
      ),
    ],
  );

const studyGuide = (h: HtmlBuilder<Message>) => {
  const steps = [
    ["Choose a template", "Set up the details you want to observe."],
    ["Capture the work", "Record each task as it happens."],
    ["Take insights with you", "Review and export what you learned."],
  ] as const;

  return h.ol(
    [h.Class("study-guide")],
    steps.map(([title, description], index) =>
      h.li(
        [],
        [
          h.span([h.Class("study-guide-number")], [`${index + 1}`]),
          h.div([], [h.h3([], [title]), h.p([], [description])]),
        ],
      ),
    ),
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

  return h.div(
    [h.Class("start-page")],
    [
      h.div(
        [h.Class("start-layout")],
        [
          heroHeader(h),
          h.div(
            [h.Class("start-action")],
            [
              hasActive
                ? resumeView(
                    model.activeSession as ActiveSession,
                    model.templates,
                    model.pendingDiscardSession,
                    h,
                  )
                : model.templates.length === 0
                  ? noTemplatesView(h)
                  : startFormCard(
                      model.templates,
                      model.selectedTemplateId,
                      model.placeholderName,
                      model.sessionNameInput,
                      h,
                    ),
            ],
          ),
          studyGuide(h),
        ],
      ),
    ],
  );
};
