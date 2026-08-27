import { svgIcon } from "../../ui";
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
  svgIcon(classes, h, [
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
  ]);

// ── Desktop / Tablet Data Table ─────────────────────────────────────────────

const desktopTemplatesTable = (
  templates: ReadonlyArray<TemplateSummary>,
  h: HtmlBuilder<Message>,
) =>
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
                    ["Template Name"],
                  ),
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold")],
                    ["Fields"],
                  ),
                  h.th(
                    [h.Attribute("scope", "col"), h.Class("py-3.5 px-4 font-semibold")],
                    ["Last Updated"],
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
            templates.map((template) =>
              h.tr(
                [
                  h.Class("cursor-pointer hover:bg-base-200/50 transition-colors group"),
                  h.OnClick(Message.ClickedTemplateRow({ id: template.id })),
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
                            [template.name],
                          ),
                          ...(template.isDefault
                            ? [
                                h.span(
                                  [
                                    h.Class(
                                      "badge badge-sm border-none bg-accent/15 font-semibold text-accent text-[11px]",
                                    ),
                                  ],
                                  ["Default"],
                                ),
                              ]
                            : []),
                        ],
                      ),
                    ],
                  ),
                  h.td(
                    [h.Class("py-3.5 px-4 text-xs text-base-content/70")],
                    [fieldSummaryLine(template.fieldCount, template.requiredCount)],
                  ),
                  h.td(
                    [h.Class("py-3.5 px-4 font-mono text-xs text-base-content/60")],
                    [formatTimestamp(template.updatedAt)],
                  ),
                  h.td(
                    [h.Class("py-3.5 px-4 text-right")],
                    [
                      h.div(
                        [
                          h.Class("flex items-center justify-end gap-1"),
                          h.Attribute("onclick", "event.stopPropagation()"),
                        ],
                        [kebabMenu(template, h)],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
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
  if (model.templates.length === 0) {
    return h.div(
      [h.Class("min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col")],
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
              [docIcon("h-8 w-8", h)],
            ),
            h.h3([h.Class("text-base font-bold text-base-content")], ["No Templates"]),
            h.p(
              [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/60")],
              [
                "Create a template to define the fields you want to capture during your time and motion studies.",
              ],
            ),
            h.button(
              [
                h.Class(
                  "btn btn-primary mt-6 rounded-field gap-2 text-sm font-semibold shadow-sm active:scale-[0.98] transition-all px-6",
                ),
                h.OnClick(Message.ClickedNewTemplate()),
                h.AriaLabel("Create Template"),
              ],
              [h.span([h.Class("text-lg leading-none")], ["+"]), "Create Template"],
            ),
          ],
        ),
        ...(model.showCreate ? [createModal(model.newName, h)] : []),
        ...(model.pendingDelete === null ? [] : [deleteModal(model.pendingDelete, h)]),
        ...(model.lastError === null ? [] : [errorAlert(model.lastError, h)]),
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
          desktopTemplatesTable(model.templates, h),

          // Mobile card list
          h.div(
            [
              h.Class(
                "md:hidden divide-y divide-base-200 overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-xs",
              ),
            ],
            model.templates.map((t) => templateRow(t, h)),
          ),
          h.p(
            [h.Class("px-1 text-[11px] text-base-content/50 font-medium")],
            ["Templates define the form schema and questions captured during each study task."],
          ),
        ],
      ),
      ...(model.showCreate ? [createModal(model.newName, h)] : []),
      ...(model.pendingDelete === null ? [] : [deleteModal(model.pendingDelete, h)]),
      ...(model.lastError === null ? [] : [errorAlert(model.lastError, h)]),
    ],
  );
};

const templateRow = (template: TemplateSummary, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    template.id,
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
          h.OnClick(Message.ClickedTemplateRow({ id: template.id })),
          h.AriaLabel(`Edit template ${template.name}`),
        ],
        [
          h.div(
            [h.Class("flex w-full items-center justify-between gap-2")],
            [
              h.span(
                [h.Class("truncate text-sm font-semibold text-base-content")],
                [template.name],
              ),
              ...(template.isDefault
                ? [
                    h.span(
                      [
                        h.Class(
                          "badge badge-sm shrink-0 border-none bg-accent/15 font-semibold text-accent text-[11px]",
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
            [h.Class("text-[11px] font-mono text-base-content/40")],
            [`Updated ${formatTimestamp(template.updatedAt)}`],
          ),
        ],
      ),
      kebabMenu(template, h),
    ],
  );

const createModal = (newName: string, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
      h.AriaLabel("New Template Dialog"),
    ],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5 bg-base-100")],
        [
          h.h3([h.Class("text-base font-bold text-base-content")], ["New Template"]),
          h.p(
            [h.Class("mt-1 text-xs text-base-content/60")],
            ["Enter a name for your new time study template."],
          ),
          h.input([
            h.Class(
              "input input-bordered mt-3 w-full rounded-field bg-base-100 text-sm focus-visible:input-primary focus-visible:outline-none placeholder:text-base-content/40",
            ),
            h.Value(newName),
            h.Placeholder("e.g., Assembly Line Study"),
            h.AriaLabel("Template Name"),
            h.Autofocus(true),
            h.OnInput((value) => Message.ChangedNewName({ text: value })),
            h.OnKeyDownPreventDefault((key) =>
              key === "Enter" && newName.trim() !== ""
                ? Option.some(Message.ConfirmedCreateTemplate())
                : Option.none(),
            ),
          ]),
          h.div(
            [h.Class("modal-action mt-5 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class(
                    "btn btn-primary btn-block rounded-field text-xs font-semibold sm:flex-1 disabled:opacity-50",
                  ),
                  h.Disabled(newName.trim() === ""),
                  h.OnClick(Message.ConfirmedCreateTemplate()),
                  h.AriaLabel("Create Template"),
                ],
                ["Create"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledCreateTemplate()),
                  h.AriaLabel("Cancel"),
                ],
                ["Cancel"],
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
    [
      h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs"),
      h.Attribute("role", "dialog"),
      h.Attribute("aria-modal", "true"),
      h.AriaLabel("Delete template confirmation"),
    ],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5 bg-base-100")],
        [
          h.h3([h.Class("text-base font-bold text-base-content")], ["Delete Template?"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")],
            [`Are you sure you want to delete "${pending.name}"? This action cannot be undone.`],
          ),
          h.div(
            [h.Class("modal-action mt-5 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedDeleteTemplate()),
                  h.AriaLabel("Confirm delete"),
                ],
                ["Delete"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledDeleteTemplate()),
                  h.AriaLabel("Cancel delete"),
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
  h.div(
    [
      h.Class(
        "alert alert-warning mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-4 py-2 text-sm shadow-xs",
      ),
    ],
    [error],
  );
