import type { HtmlBuilder } from "foldkit/html";
import { Message } from "../../../messages";
import type { Theme } from "../../theme";

export const settingsPage = (theme: Theme, saveFailed: boolean, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12")],
    [
      h.h2([h.Class("text-2xl font-medium tracking-tight")], ["Settings"]),
      h.p([h.Class("mt-2 text-sm text-muted-foreground")], ["Make Optio feel right for you."]),
      h.fieldset(
        [h.Class("mt-8 border-t border-base-300 pt-6")],
        [
          h.legend([h.Class("text-sm font-medium pr-3")], ["Appearance"]),
          h.div(
            [h.Class("grid grid-cols-3 gap-2")],
            (["light", "dark", "auto"] as const).map((value) =>
              h.label(
                [h.Class("theme-option")],
                [
                  h.input([
                    h.Type("radio"),
                    h.Name("theme"),
                    h.Value(value),
                    h.Checked(theme === value),
                    h.OnChange(() => Message.SelectedTheme({ theme: value })),
                  ]),
                  h.span([], [value === "auto" ? "Auto" : value === "dark" ? "Dark" : "Light"]),
                ],
              ),
            ),
          ),
          h.p(
            [h.Class("mt-3 text-xs text-muted-foreground")],
            ["Auto follows your device’s appearance."],
          ),
          h.p(
            [h.Class("mt-2 text-xs text-muted-foreground"), h.Attribute("role", "status")],
            saveFailed
              ? [
                  "Applied for this visit, but couldn’t save. Your choice may reset when you reopen Optio. Allow site storage or free up space, then retry.",
                ]
              : [],
          ),
          ...(saveFailed
            ? [
                h.button(
                  [
                    h.Type("button"),
                    h.Class("mt-1 min-h-11 text-sm text-primary underline underline-offset-4"),
                    h.OnClick(Message.SelectedTheme({ theme })),
                  ],
                  ["Retry saving"],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
