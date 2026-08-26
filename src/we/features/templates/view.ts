import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import { formatTimestamp } from "../../../we/format";
import { fieldSummaryLine } from "./naming";
import type { TemplateSummary } from "../../../we/types";

// TemplatesTab — list of template rows with kebab actions (Set as Default,
// Duplicate, Delete), a create modal and a delete confirmation.

const kebabMenu = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("dropdown dropdown-end self-center pr-1")],
    [
      h.div(
        [
          h.Tabindex(0),
          h.Class("btn btn-ghost btn-sm btn-circle"),
          h.AriaLabel(`Actions for "${template.name}"`),
        ],
        [h.span([h.Class("text-xl leading-none")], ["⋯"])],
      ),
      h.ul(
        [
          h.Tabindex(0),
          h.Class(
            "dropdown-content menu z-40 mt-1 w-52 rounded-box border border-base-300 bg-base-100 p-1.5 text-sm shadow-lg",
          ),
        ],
        [
          ...(template.isDefault
            ? []
            : [
                h.li(
                  [],
                  [
                    h.button(
                      [h.OnClick(Message.ClickedSetDefaultTemplate({ id: template.id }))],
                      ["Set as Default"],
                    ),
                  ],
                ),
              ]),
          h.li(
            [],
            [
              h.button(
                [h.OnClick(Message.ClickedDuplicateTemplate({ id: template.id }))],
                ["Duplicate"],
              ),
            ],
          ),
          h.li(
            [],
            [
              h.button(
                [
                  h.Class("text-error"),
                  h.OnClick(
                    Message.RequestedDeleteTemplate({ id: template.id, name: template.name }),
                  ),
                ],
                ["Delete"],
              ),
            ],
          ),
        ],
      ),
    ],
  );

const docIcon = (classes: string, h: HtmlBuilder<Message>) =>
  h.svg(
    [
      h.Class(classes),
      h.Attribute("viewBox", "0 0 24 24"),
      h.Attribute("fill", "none"),
      h.Attribute("stroke", "currentColor"),
      h.Attribute("stroke-width", "2"),
      h.Attribute("stroke-linecap", "round"),
      h.Attribute("stroke-linejoin", "round"),
    ],
    [
      h.path(
        [h.Attribute("d", "M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z")],
        [],
      ),
      h.polyline([h.Attribute("points", "14 2 14 7 19 7")], []),
      h.line(
        [
          h.Attribute("x1", "9"),
          h.Attribute("y1", "13"),
          h.Attribute("x2", "15"),
          h.Attribute("y2", "13"),
        ],
        [],
      ),
      h.line(
        [
          h.Attribute("x1", "9"),
          h.Attribute("y1", "17"),
          h.Attribute("x2", "13"),
          h.Attribute("y2", "17"),
        ],
        [],
      ),
    ],
  );

export const templatesPage = (
  model: {
    readonly templates: ReadonlyArray<TemplateSummary>;
    readonly showCreate: boolean;
    readonly newName: string;
    readonly pendingDelete: { readonly id: string; readonly name: string } | null;
    readonly lastError: string | null;
  },
  h: HtmlBuilder<Message>,
) => {
  const list =
    model.templates.length === 0
      ? []
      : [
          h.div(
            [h.Class("mx-auto w-full max-w-3xl px-4 pt-3")],
            [
              h.div(
                [
                  h.Class(
                    "divide-y divide-base-200 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm",
                  ),
                ],
                model.templates.map((t) => templateRow(t, h)),
              ),
              h.p(
                [h.Class("px-1 pt-2 text-[11px] text-base-content/40")],
                ["Templates define the fields captured during every session."],
              ),
            ],
          ),
        ];

  const empty =
    model.templates.length === 0
      ? [
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
                    [docIcon("h-7 w-7", h)],
                  ),
                  h.h3([h.Class("text-base font-semibold")], ["No Templates"]),
                  h.p(
                    [h.Class("mt-1 text-xs leading-relaxed text-base-content/60")],
                    [
                      "Create a template to define the fields you want to capture during your time and motion studies.",
                    ],
                  ),
                  h.button(
                    [
                      h.Class(
                        "btn btn-primary mx-auto mt-5 block h-12 max-w-[240px] rounded-field text-sm font-semibold shadow-sm transition-transform active:scale-[0.98]",
                      ),
                      h.OnClick(Message.ClickedNewTemplate()),
                    ],
                    ["Create Template"],
                  ),
                ],
              ),
            ],
          ),
        ]
      : [];

  return h.div(
    [h.Class("min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))]")],
    [
      ...empty,
      ...list,
      ...(model.showCreate ? [createModal(model.newName, h)] : []),
      ...(model.pendingDelete === null ? [] : [deleteModal(model.pendingDelete, h)]),
      ...(model.lastError === null ? [] : [errorAlert(model.lastError, h)]),
    ],
  );
};

const templateRow = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    template.id,
    // Micro-scale press feedback (design system §4.2).
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
          h.OnClick(Message.ClickedTemplateRow({ id: template.id })),
          h.AriaLabel(`Edit template ${template.name}`),
        ],
        [
          h.span(
            [h.Class("flex w-full items-center gap-2")],
            [
              h.span([h.Class("truncate text-sm font-semibold")], [template.name]),
              ...(template.isDefault
                ? [
                    h.span(
                      [
                        h.Class(
                          "badge badge-sm shrink-0 border-none bg-accent/15 font-medium text-accent",
                        ),
                      ],
                      ["Default"],
                    ),
                  ]
                : []),
            ],
          ),
          h.span(
            [h.Class("text-xs text-base-content/60")],
            [fieldSummaryLine(template.fieldCount, template.requiredCount)],
          ),
          h.span(
            [h.Class("text-[11px] text-base-content/40")],
            [`Updated ${formatTimestamp(template.updatedAt)}`],
          ),
        ],
      ),
      kebabMenu(template, h),
    ],
  );

const createModal = (newName: string, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("modal modal-open")],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5")],
        [
          h.h3([h.Class("text-base font-bold")], ["New Template"]),
          h.input([
            h.Class(
              "input input-bordered mt-3 w-full rounded-field bg-base-100 text-base focus-visible:outline-none",
            ),
            h.Value(newName),
            h.Placeholder("Template Name"),
            h.Autofocus(true),
            h.OnInput((value) => Message.ChangedNewName({ text: value })),
            h.OnKeyDownPreventDefault((key) =>
              key === "Enter" && newName.trim() !== ""
                ? Option.some(Message.ConfirmedCreateTemplate())
                : Option.none(),
            ),
          ]),
          h.div(
            [h.Class("modal-action mt-4 gap-2")],
            [
              h.button(
                [
                  h.Class("btn btn-ghost rounded-field"),
                  h.OnClick(Message.CanceledCreateTemplate()),
                ],
                ["Cancel"],
              ),
              h.button(
                [
                  h.Class("btn btn-primary rounded-field"),
                  h.Disabled(newName.trim() === ""),
                  h.OnClick(Message.ConfirmedCreateTemplate()),
                ],
                ["Save"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledCreateTemplate())], []),
    ],
  );

const deleteModal = (
  pending: { readonly id: string; readonly name: string },
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class("modal modal-open")],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5")],
        [
          h.h3([h.Class("text-base font-bold")], ["Delete?"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")],
            [`Are you sure you want to delete "${pending.name}"? This action cannot be undone.`],
          ),
          h.div(
            [h.Class("modal-action mt-4 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedDeleteTemplate()),
                ],
                ["Delete"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledDeleteTemplate()),
                ],
                ["Cancel"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledDeleteTemplate())], []),
    ],
  );

const errorAlert = (error: string, h: HtmlBuilder<Message>) =>
  h.div([h.Class("alert alert-warning mx-auto mt-4 max-w-3xl py-2 text-sm")], [error]);
