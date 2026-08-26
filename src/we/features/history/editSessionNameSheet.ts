import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import { Message } from "../../../messages";

type EditModel = {
  readonly showEditHistoryName: boolean;
  readonly editHistoryNameInput: string;
  readonly selectedHistorySession: {
    readonly templateName: string;
  } | null;
};

export const editSessionNameSheet = (model: EditModel, h: HtmlBuilder<Message>) => {
  if (!model.showEditHistoryName) return h.div([], []);
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
            [
              h.Class(
                "sticky top-0 z-10 bg-base-100 border-b border-base-200 px-5 py-4 flex items-center justify-between",
              ),
            ],
            [
              h.h3([h.Class("text-base font-bold")], ["Edit Session"]),
              h.button(
                [
                  h.Class("btn btn-ghost btn-sm rounded-field"),
                  h.OnClick(Message.CanceledEditHistoryName()),
                ],
                ["Cancel"],
              ),
            ],
          ),
          h.div(
            [h.Class("flex-1 space-y-4 p-5")],
            [
              h.div(
                [h.Class("rounded-box bg-base-100 border border-base-300 overflow-hidden")],
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
                        ["Name"],
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class("p-4")],
                    [
                      // NOTE (S7): Swift focuses this field ~500ms after the sheet
                      // appears (keyboard-delay nicety). Deferred — a setTimeout
                      // in a Subscription is fiddly for marginal gain; immediate
                      // autofocus here instead. focus-visible only, per the
                      // Safari checklist — raw `focus:` rings persist on touch.
                      h.input([
                        h.Class(
                          "input input-bordered w-full rounded-field text-base md:text-sm bg-base-100 focus-visible:input-primary focus-visible:outline-none placeholder:text-base-content/40",
                        ),
                        h.Value(model.editHistoryNameInput),
                        h.Placeholder("Session Name"),
                        h.Autofocus(true),
                        h.OnInput((value) => Message.ChangedEditHistoryName({ text: value })),
                        h.OnKeyDownPreventDefault((key) =>
                          key === "Enter"
                            ? Option.some(Message.ConfirmedEditHistoryName())
                            : Option.none(),
                        ),
                      ]),
                      h.p(
                        [h.Class("mt-2 text-[11px] leading-relaxed text-base-content/60")],
                        [
                          "Enter a custom name for this session, or leave blank to use the default.",
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              // Read-only Template row
              ...(model.selectedHistorySession
                ? [
                    h.div(
                      [
                        h.Class(
                          "flex items-center justify-between rounded-field border border-base-200 bg-base-100 px-4 py-3",
                        ),
                      ],
                      [
                        h.span([h.Class("text-sm text-base-content/60")], ["Template"]),
                        h.span(
                          [h.Class("text-sm font-medium")],
                          [model.selectedHistorySession.templateName],
                        ),
                      ],
                    ),
                  ]
                : []),
            ],
          ),
          h.div(
            [
              h.Class(
                "sticky bottom-0 bg-base-100 border-t border-base-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-2",
              ),
            ],
            [
              h.button(
                [
                  h.Class("btn btn-ghost flex-1 rounded-field"),
                  h.OnClick(Message.CanceledEditHistoryName()),
                ],
                ["Cancel"],
              ),
              h.button(
                [
                  h.Class("btn btn-primary flex-1 rounded-field font-semibold"),
                  h.OnClick(Message.ConfirmedEditHistoryName()),
                ],
                ["Save"],
              ),
            ],
          ),
        ],
      ),
      h.button([h.Class("modal-backdrop"), h.OnClick(Message.CanceledEditHistoryName())], []),
    ],
  );
};
