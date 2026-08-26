import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { Message } from "../../../messages";
import type { FieldDef } from "../../../livestore/schema";
import { fieldDisplayName, hasOptions, supportsRequired } from "../../fields";
import { FIELD_KINDS } from "../../fields";
import { hasChanges, isDraftValid, isTemplateValid } from "./editor";
import type { FieldKind } from "../../../livestore/schema";

// ── Icon helpers ───────────────────────────────────────────────────────────

const kindIcon = (kind: FieldKind, classes: string, h: HtmlBuilder<Message>) => {
  const attrs = [
    h.Class(classes),
    h.Attribute("viewBox", "0 0 24 24"),
    h.Attribute("fill", "none"),
    h.Attribute("stroke", "currentColor"),
    h.Attribute("stroke-width", "1.8"),
    h.Attribute("stroke-linecap", "round"),
    h.Attribute("stroke-linejoin", "round"),
  ];
  switch (kind) {
    case "radio":
      return h.svg(
        [...attrs],
        [
          h.circle([h.Attribute("cx", "12"), h.Attribute("cy", "12"), h.Attribute("r", "9")], []),
          h.circle(
            [
              h.Attribute("cx", "12"),
              h.Attribute("cy", "12"),
              h.Attribute("r", "4"),
              h.Attribute("fill", "currentColor"),
              h.Attribute("stroke", "none"),
            ],
            [],
          ),
        ],
      );
    case "checkbox":
      return h.svg(
        [...attrs],
        [
          h.rect(
            [
              h.Attribute("x", "3"),
              h.Attribute("y", "3"),
              h.Attribute("width", "18"),
              h.Attribute("height", "18"),
              h.Attribute("rx", "3"),
            ],
            [],
          ),
          h.path([h.Attribute("d", "M7 12l3 3l6 -6")], []),
        ],
      );
    case "textInput":
      return h.svg(
        [...attrs],
        [
          h.rect(
            [
              h.Attribute("x", "4"),
              h.Attribute("y", "6"),
              h.Attribute("width", "16"),
              h.Attribute("height", "12"),
              h.Attribute("rx", "2"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "8"),
              h.Attribute("y1", "12"),
              h.Attribute("x2", "16"),
              h.Attribute("y2", "12"),
            ],
            [],
          ),
        ],
      );
    case "textArea":
      return h.svg(
        [...attrs],
        [
          h.rect(
            [
              h.Attribute("x", "4"),
              h.Attribute("y", "4"),
              h.Attribute("width", "16"),
              h.Attribute("height", "16"),
              h.Attribute("rx", "2"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "7"),
              h.Attribute("y1", "9"),
              h.Attribute("x2", "17"),
              h.Attribute("y2", "9"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "7"),
              h.Attribute("y1", "13"),
              h.Attribute("x2", "17"),
              h.Attribute("y2", "13"),
            ],
            [],
          ),
          h.line(
            [
              h.Attribute("x1", "7"),
              h.Attribute("y1", "17"),
              h.Attribute("x2", "13"),
              h.Attribute("y2", "17"),
            ],
            [],
          ),
        ],
      );
    case "boolean":
      return h.svg(
        [...attrs],
        [
          h.rect(
            [
              h.Attribute("x", "2"),
              h.Attribute("y", "7"),
              h.Attribute("width", "20"),
              h.Attribute("height", "10"),
              h.Attribute("rx", "5"),
            ],
            [],
          ),
          h.circle(
            [
              h.Attribute("cx", "17"),
              h.Attribute("cy", "12"),
              h.Attribute("r", "3"),
              h.Attribute("fill", "currentColor"),
              h.Attribute("stroke", "none"),
            ],
            [],
          ),
        ],
      );
  }
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

// ── Model shape expected by the view ───────────────────────────────────────

type EditorModel = {
  readonly editor: {
    readonly id: string;
    readonly name: string;
    readonly isDefault: boolean;
    readonly fields: ReadonlyArray<FieldDef>;
    readonly original: {
      readonly name: string;
      readonly isDefault: boolean;
      readonly fields: ReadonlyArray<FieldDef>;
    };
    readonly isSaving: boolean;
    readonly showAddField: boolean;
    readonly editingFieldId: string | null;
    readonly draft: {
      readonly id: string;
      readonly name: string;
      readonly kind: string;
      readonly isRequired: boolean;
      readonly defaultValue: string;
      readonly sortOrder: number;
      readonly options: ReadonlyArray<string>;
      readonly exclusiveOptions: ReadonlyArray<string>;
      readonly newOptionText: string;
    } | null;
    readonly pendingDiscard: boolean;
  } | null;
  readonly lastError: string | null;
};

// ── Public entry ───────────────────────────────────────────────────────────

export const templateEditorPage = (model: EditorModel, h: HtmlBuilder<Message>) => {
  if (model.editor === null) {
    return h.div(
      [h.Class("flex h-full items-center justify-center px-6 py-12 text-center")],
      [
        h.div(
          [h.Class("flex flex-col items-center gap-2")],
          [
            h.div([h.Class("loading loading-spinner loading-sm text-base-content/40")], []),
            h.p([h.Class("text-sm text-base-content/60")], ["Loading template…"]),
            ...(model.lastError === null
              ? []
              : [h.p([h.Class("mt-2 text-xs text-error")], [model.lastError])]),
          ],
        ),
      ],
    );
  }

  const editor = model.editor;
  const isValid = isTemplateValid(editor);
  const _hasChanges = hasChanges(editor as unknown as Parameters<typeof hasChanges>[0]);

  return h.div(
    [h.Class("flex min-h-full flex-col")],
    [
      h.div(
        [h.Class("mx-auto w-full max-w-3xl px-4 pt-4 pb-4 space-y-4 flex-1")],
        [
          // Template Info card
          h.div(
            [h.Class("rounded-box bg-base-100 border border-base-300 shadow-sm overflow-hidden")],
            [
              h.div(
                [h.Class("px-4 py-2 bg-base-100 border-b border-base-200")],
                [
                  h.span(
                    [
                      h.Class(
                        "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                      ),
                    ],
                    ["Template Info"],
                  ),
                ],
              ),
              h.div(
                [h.Class("p-4 space-y-4")],
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
                        ["Template Name"],
                      ),
                      h.input([
                        h.Class(
                          "input input-bordered w-full rounded-field text-base md:text-sm bg-base-100 focus-visible:input-primary focus-visible:outline-none transition-colors placeholder:text-base-content/40",
                        ),
                        h.Value(editor.name),
                        h.Placeholder("Template Name"),
                        h.Autofocus(false),
                        h.OnInput((value) => Message.ChangedEditorName({ text: value })),
                      ]),
                    ],
                  ),
                  h.label(
                    [h.Class("flex items-center justify-between py-2 cursor-pointer select-none")],
                    [
                      h.div(
                        [h.Class("flex flex-col pr-3 text-left")],
                        [
                          h.span(
                            [h.Class("text-sm font-medium text-base-content")],
                            ["Set as Default"],
                          ),
                          h.span(
                            [h.Class("text-xs leading-relaxed text-base-content/60")],
                            [
                              "The default template is automatically selected when starting new sessions.",
                            ],
                          ),
                        ],
                      ),
                      h.input([
                        h.Class("toggle toggle-primary checked:border-primary shrink-0"),
                        h.Type("checkbox"),
                        h.Checked(editor.isDefault),
                        h.OnChange(() => Message.ToggledEditorDefault()),
                      ]),
                    ],
                  ),
                ],
              ),
            ],
          ),

          // Fields card
          h.div(
            [
              h.Class(
                "rounded-box bg-base-100 border border-base-300 shadow-sm overflow-hidden divide-y divide-base-200",
              ),
            ],
            [
              h.div(
                [h.Class("flex items-center justify-between px-4 py-2 bg-base-100")],
                [
                  h.span(
                    [
                      h.Class(
                        "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                      ),
                    ],
                    ["Fields"],
                  ),
                ],
              ),
              ...(editor.fields.length === 0
                ? [
                    h.div(
                      [h.Class("px-4 py-6 text-center bg-base-100")],
                      [
                        h.p(
                          [h.Class("text-sm italic text-base-content/50")],
                          ["No fields added yet"],
                        ),
                      ],
                    ),
                  ]
                : [
                    h.div(
                      [h.Class("divide-y divide-base-200 bg-base-100")],
                      editor.fields.map((field, index) =>
                        fieldRow(field, index, editor.fields.length, h),
                      ),
                    ),
                  ]),
              h.div(
                [h.Class("px-4 py-3 bg-base-100")],
                [
                  h.button(
                    [
                      h.Class(
                        "btn btn-ghost btn-sm gap-1 text-primary font-semibold hover:bg-transparent active:opacity-60",
                      ),
                      h.OnClick(Message.ClickedAddField()),
                    ],
                    [h.span([h.Class("text-lg leading-none")], ["+"]), "Add Field"],
                  ),
                ],
              ),
              h.p(
                [h.Class("px-4 py-2 text-[11px] text-base-content/40 bg-base-100")],
                ["Fields define what information is captured for each task. Use ↑↓ to reorder."],
              ),
            ],
          ),

          ...(model.lastError === null
            ? []
            : [h.div([h.Class("alert alert-warning py-2 text-sm")], [model.lastError])]),
        ],
      ),

      // Sticky Save/Cancel footer
      h.div(
        [
          h.Class(
            "sticky bottom-0 z-20 border-t border-base-300 bg-base-100/90 backdrop-blur-md px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          ),
        ],
        [
          h.div(
            [h.Class("mx-auto flex max-w-3xl gap-2")],
            [
              h.button(
                [
                  h.Class("btn btn-ghost flex-1 rounded-field"),
                  h.OnClick(Message.ClickedCancelEditTemplate()),
                ],
                ["Cancel"],
              ),
              h.button(
                [
                  h.Class("btn btn-primary flex-1 rounded-field"),
                  h.Disabled(!isValid || !_hasChanges || editor.isSaving),
                  h.OnClick(Message.ClickedSaveTemplate()),
                ],
                [editor.isSaving ? "Saving…" : "Save"],
              ),
            ],
          ),
        ],
      ),

      // Field editor modal
      ...(editor.draft !== null ? [fieldModal(editor, h)] : []),

      // Discard confirm modal
      ...(editor.pendingDiscard ? [discardModal(h)] : []),
    ],
  );
};

const fieldRow = (field: FieldDef, index: number, total: number, h: HtmlBuilder<Message>) =>
  h.keyed("div")(
    field.id,
    [
      h.Class(
        "flex items-center gap-3 bg-base-100 px-3 py-3 transition-colors active:bg-base-200/50",
      ),
    ],
    [
      kindIcon(field.kind as FieldKind, "h-6 w-6 shrink-0 text-secondary", h),
      h.button(
        [
          h.Class("flex min-w-0 grow flex-col items-start gap-0.5 text-left"),
          h.OnClick(Message.ClickedEditField({ id: field.id })),
          h.AriaLabel(`Edit field ${field.name}`),
        ],
        [
          h.span(
            [h.Class("flex w-full items-center gap-2")],
            [
              h.span(
                [h.Class("truncate text-sm font-medium text-base-content")],
                [field.name || "Untitled field"],
              ),
              ...(field.isRequired
                ? [
                    h.span(
                      [
                        h.Class(
                          "badge badge-sm shrink-0 border-none bg-accent/15 font-medium text-accent",
                        ),
                      ],
                      ["Required"],
                    ),
                  ]
                : []),
            ],
          ),
          h.span(
            [h.Class("text-xs text-base-content/60")],
            [
              hasOptions(field.kind as FieldKind)
                ? `${fieldDisplayName(field.kind as FieldKind)} (${field.options.length} option${field.options.length === 1 ? "" : "s"})`
                : fieldDisplayName(field.kind as FieldKind),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("flex shrink-0 items-center gap-0.5")],
        [
          h.button(
            [
              h.Class("btn btn-ghost btn-xs btn-circle"),
              h.Disabled(index === 0),
              h.AriaLabel("Move up"),
              h.OnClick(Message.ClickedMoveFieldUp({ id: field.id })),
            ],
            [h.span([h.Class("text-sm leading-none")], ["↑"])],
          ),
          h.button(
            [
              h.Class("btn btn-ghost btn-xs btn-circle"),
              h.Disabled(index === total - 1),
              h.AriaLabel("Move down"),
              h.OnClick(Message.ClickedMoveFieldDown({ id: field.id })),
            ],
            [h.span([h.Class("text-sm leading-none")], ["↓"])],
          ),
          h.button(
            [
              h.Class("btn btn-ghost btn-xs text-error hover:bg-error/10"),
              h.AriaLabel(`Delete ${field.name}`),
              h.OnClick(Message.ClickedDeleteField({ id: field.id })),
            ],
            ["✕"],
          ),
          h.button(
            [
              h.Class("ml-1 flex items-center"),
              h.OnClick(Message.ClickedEditField({ id: field.id })),
            ],
            [chevronRight(h)],
          ),
        ],
      ),
    ],
  );

const fieldModal = (editor: NonNullable<EditorModel["editor"]>, h: HtmlBuilder<Message>) => {
  const draft = editor.draft;
  if (draft === null) return h.div([], []);
  const isEditing = editor.editingFieldId !== null;
  const title = isEditing ? "Edit Field" : "Add Field";
  const kind = draft.kind as FieldKind;
  const valid = isDraftValid(draft as unknown as Parameters<typeof isDraftValid>[0]);

  return h.div(
    [h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs")],
    [
      h.div(
        [
          h.Class(
            "modal-box max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-t-box sm:rounded-box bg-base-100 p-0 border border-base-300 flex flex-col",
          ),
        ],
        [
          // Header
          h.div(
            [h.Class("sticky top-0 z-10 bg-base-100 border-b border-base-200 px-5 py-4")],
            [h.h3([h.Class("text-base font-bold")], [title])],
          ),
          // Body
          h.div(
            [h.Class("flex-1 space-y-5 p-5")],
            [
              // Field Info
              h.div(
                [h.Class("space-y-3")],
                [
                  h.div(
                    [
                      h.Class(
                        "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                      ),
                    ],
                    ["Field Info"],
                  ),
                  h.fieldset(
                    [h.Class("fieldset p-0 gap-1.5 w-full")],
                    [
                      h.legend(
                        [
                          h.Class(
                            "fieldset-legend text-xs font-semibold uppercase tracking-wider text-base-content/70",
                          ),
                        ],
                        ["Field Name"],
                      ),
                      h.input([
                        h.Class(
                          "input input-bordered w-full rounded-field text-base md:text-sm bg-base-100 focus-visible:input-primary focus-visible:outline-none transition-colors placeholder:text-base-content/40",
                        ),
                        h.Value(draft.name),
                        h.Placeholder("Field Name"),
                        h.Autofocus(true),
                        h.OnInput((value) => Message.ChangedFieldName({ text: value })),
                      ]),
                    ],
                  ),
                  h.fieldset(
                    [h.Class("fieldset p-0 gap-1.5 w-full")],
                    [
                      h.legend(
                        [
                          h.Class(
                            "fieldset-legend text-xs font-semibold uppercase tracking-wider text-base-content/70",
                          ),
                        ],
                        ["Field Type"],
                      ),
                      h.div(
                        [h.Class("grid grid-cols-2 gap-2")],
                        FIELD_KINDS.map((candidate) =>
                          h.button(
                            [
                              h.Class(
                                `btn btn-sm rounded-field text-xs font-medium border transition-colors ${
                                  candidate === kind
                                    ? "btn-primary border-primary text-primary-content shadow-sm"
                                    : "btn-ghost border-base-300 bg-base-100 hover:bg-base-200 text-base-content"
                                }`,
                              ),
                              h.OnClick(Message.ChangedFieldKind({ kind: candidate })),
                            ],
                            [fieldDisplayName(candidate as FieldKind)],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // Required toggle
              ...(supportsRequired(kind)
                ? [
                    h.label(
                      [
                        h.Class(
                          "flex items-center justify-between rounded-field border border-base-200 bg-base-100 px-3 py-2.5 cursor-pointer select-none",
                        ),
                      ],
                      [
                        h.div(
                          [h.Class("flex flex-col pr-3 text-left")],
                          [
                            h.span([h.Class("text-sm font-medium")], ["Required"]),
                            h.span(
                              [h.Class("text-xs text-base-content/60")],
                              ["Required fields must be completed before a task can be saved."],
                            ),
                          ],
                        ),
                        h.input([
                          h.Class("toggle toggle-primary checked:border-primary shrink-0"),
                          h.Type("checkbox"),
                          h.Checked(draft.isRequired),
                          h.OnChange(() => Message.ToggledFieldRequired()),
                        ]),
                      ],
                    ),
                  ]
                : []),

              // Options section
              ...(hasOptions(kind)
                ? [
                    h.div(
                      [h.Class("space-y-3 rounded-box border border-base-200 bg-base-100 p-3")],
                      [
                        h.div(
                          [h.Class("flex items-center justify-between")],
                          [
                            h.span(
                              [
                                h.Class(
                                  "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                                ),
                              ],
                              ["Options"],
                            ),
                          ],
                        ),
                        ...(draft.options.length === 0
                          ? [
                              h.p(
                                [h.Class("text-sm italic text-base-content/50 py-2 text-center")],
                                ["No options added yet"],
                              ),
                            ]
                          : [
                              h.div(
                                [
                                  h.Class(
                                    "divide-y divide-base-200 overflow-hidden rounded-field border border-base-200 bg-base-100",
                                  ),
                                ],
                                draft.options.map((option, optionIndex) =>
                                  h.keyed("div")(
                                    `opt-${optionIndex}-${option}`,
                                    [h.Class("flex items-center gap-2 px-3 py-2 bg-base-100")],
                                    [
                                      h.span([h.Class("flex-1 truncate text-sm")], [option]),
                                      ...(kind === "checkbox"
                                        ? [
                                            h.button(
                                              [
                                                h.Class(
                                                  `btn btn-xs rounded-field text-xs font-medium border ${
                                                    draft.exclusiveOptions.includes(option)
                                                      ? "btn-error text-error border-error/20 bg-error/10"
                                                      : "btn-ghost border-base-300 text-base-content/60"
                                                  }`,
                                                ),
                                                h.Title(
                                                  "Exclusionary option clears other selections when chosen",
                                                ),
                                                h.OnClick(
                                                  Message.ToggledExclusiveOption({
                                                    index: optionIndex,
                                                  }),
                                                ),
                                              ],
                                              [
                                                draft.exclusiveOptions.includes(option)
                                                  ? "Exclusive"
                                                  : "Normal",
                                              ],
                                            ),
                                          ]
                                        : []),
                                      h.button(
                                        [
                                          h.Class(
                                            "btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10",
                                          ),
                                          h.OnClick(
                                            Message.ClickedDeleteOption({ index: optionIndex }),
                                          ),
                                          h.AriaLabel(`Delete option ${option}`),
                                        ],
                                        ["✕"],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ]),
                        h.div(
                          [h.Class("flex gap-2")],
                          [
                            h.input([
                              h.Class(
                                "input input-bordered flex-1 rounded-field text-base md:text-sm bg-base-100 focus-visible:input-primary focus-visible:outline-none",
                              ),
                              h.Value(draft.newOptionText),
                              h.Placeholder("Option name"),
                              h.OnInput((value) => Message.ChangedNewOptionText({ text: value })),
                              h.OnKeyDownPreventDefault((key) =>
                                key === "Enter" && draft.newOptionText.trim() !== ""
                                  ? Option.some(Message.ConfirmedAddOption())
                                  : Option.none(),
                              ),
                            ]),
                            h.button(
                              [
                                h.Class("btn btn-primary btn-sm rounded-field shrink-0"),
                                h.Disabled(
                                  draft.newOptionText.trim() === "" ||
                                    draft.options.includes(draft.newOptionText.trim()),
                                ),
                                h.OnClick(Message.ConfirmedAddOption()),
                              ],
                              ["Add"],
                            ),
                          ],
                        ),
                        ...(kind === "checkbox"
                          ? [
                              h.p(
                                [h.Class("text-[11px] leading-relaxed text-base-content/60")],
                                ["Exclusionary options clear all other selections when chosen."],
                              ),
                            ]
                          : []),
                      ],
                    ),
                  ]
                : []),

              // Default Value section — hidden for option types (radio/checkbox) per spec
              ...(hasOptions(kind)
                ? []
                : [
                    h.div(
                      [h.Class("space-y-2 rounded-box border border-base-200 bg-base-100 p-3")],
                      [
                        h.span(
                          [
                            h.Class(
                              "text-xs font-semibold uppercase tracking-wider text-base-content/60",
                            ),
                          ],
                          ["Default Value"],
                        ),
                        ...(kind === "boolean"
                          ? [
                              h.label(
                                [
                                  h.Class(
                                    "flex items-center justify-between py-1 cursor-pointer select-none",
                                  ),
                                ],
                                [
                                  h.span([h.Class("text-sm font-medium")], ["Default Value"]),
                                  h.input([
                                    h.Class(
                                      "toggle toggle-primary checked:border-primary shrink-0",
                                    ),
                                    h.Type("checkbox"),
                                    h.Checked(draft.defaultValue === "true"),
                                    h.OnChange(() => Message.ToggledFieldDefaultBoolean()),
                                  ]),
                                ],
                              ),
                              h.p(
                                [h.Class("text-[11px] leading-relaxed text-base-content/60")],
                                [
                                  "Toggle fields are never required and default to off unless specified here.",
                                ],
                              ),
                            ]
                          : kind === "textArea"
                            ? [
                                h.textarea([
                                  h.Class(
                                    "textarea textarea-bordered w-full rounded-field text-base md:text-sm bg-base-100 focus-visible:textarea-primary focus-visible:outline-none min-h-[90px] leading-relaxed placeholder:text-base-content/40",
                                  ),
                                  h.Placeholder("Default Value"),
                                  h.Value(draft.defaultValue),
                                  h.OnInput((value) =>
                                    Message.ChangedFieldDefaultValue({ text: value }),
                                  ),
                                ]),
                                h.p(
                                  [h.Class("text-[11px] leading-relaxed text-base-content/60")],
                                  [
                                    "Optional. This value will be pre-filled when creating new tasks.",
                                  ],
                                ),
                              ]
                            : [
                                h.input([
                                  h.Class(
                                    "input input-bordered w-full rounded-field text-base md:text-sm bg-base-100 focus-visible:input-primary focus-visible:outline-none placeholder:text-base-content/40",
                                  ),
                                  h.Value(draft.defaultValue),
                                  h.Placeholder("Default Value"),
                                  h.OnInput((value) =>
                                    Message.ChangedFieldDefaultValue({ text: value }),
                                  ),
                                ]),
                                h.p(
                                  [h.Class("text-[11px] leading-relaxed text-base-content/60")],
                                  [
                                    "Optional. This value will be pre-filled when creating new tasks.",
                                  ],
                                ),
                              ]),
                      ],
                    ),
                  ]),
            ],
          ),
          // Footer actions
          h.div(
            [h.Class("sticky bottom-0 bg-base-100 border-t border-base-200 p-4 flex gap-2")],
            [
              h.button(
                [
                  h.Class("btn btn-ghost flex-1 rounded-field"),
                  h.OnClick(Message.CanceledAddField()),
                ],
                ["Cancel"],
              ),
              h.button(
                [
                  h.Class("btn btn-primary flex-1 rounded-field"),
                  h.Disabled(!valid),
                  h.OnClick(Message.ConfirmedSaveField()),
                ],
                ["Save"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledAddField())], []),
    ],
  );
};

const discardModal = (h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("modal modal-open modal-bottom sm:modal-middle bg-neutral/40 backdrop-blur-xs")],
    [
      h.div(
        [h.Class("modal-box max-w-sm rounded-box border border-base-300 p-5 bg-base-100")],
        [
          h.h3([h.Class("text-base font-bold")], ["Discard Changes?"]),
          h.p(
            [h.Class("mt-1.5 text-xs leading-relaxed text-base-content/70")],
            ["You have unsaved changes. Are you sure you want to discard them?"],
          ),
          h.div(
            [h.Class("modal-action mt-4 flex-col gap-2 sm:flex-row")],
            [
              h.button(
                [
                  h.Class("btn btn-error btn-block rounded-field text-xs font-semibold sm:flex-1"),
                  h.OnClick(Message.ConfirmedDiscard()),
                ],
                ["Discard"],
              ),
              h.button(
                [
                  h.Class("btn btn-ghost btn-block rounded-field text-xs sm:flex-1"),
                  h.OnClick(Message.CanceledDiscard()),
                ],
                ["Keep Editing"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledDiscard())], []),
    ],
  );
