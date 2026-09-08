import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";

import { sheet } from "@/components/app";
import { button } from "@/components/ui/button";
import { inputClass, inputLabelClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  const templateName = model.selectedHistorySession?.templateName ?? "";
  return sheet(
    {
      id: "edit-session-name",
      title: "Session name",
      onDismiss: Message.CanceledEditHistoryName(),
      dismissLabel: "Cancel editing session",
      size: "md",
      footer: [
        button(
          {
            size: "lg",
            className: "h-11 text-base font-semibold",
            onClick: Message.ConfirmedEditHistoryName(),
            attributes: [h.AriaLabel("Save session name")],
          },
          "Save",
          h,
        ),
        button(
          {
            variant: "secondary",
            size: "lg",
            className: "h-11 text-base",
            onClick: Message.CanceledEditHistoryName(),
            attributes: [h.AriaLabel("Cancel editing session name")],
          },
          "Cancel",
          h,
        ),
      ],
    },
    [
      h.div(
        [h.Class("flex flex-col gap-1.5 py-1")],
        [
          h.label(
            [
              h.For("edit-session-name"),
              h.Class(cn(inputLabelClass, "text-[0.8125rem] text-muted-foreground")),
            ],
            ["Name"],
          ),
          h.input([
            h.Id("edit-session-name"),
            h.Type("text"),
            h.Class(cn(inputClass, "h-11 rounded-lg text-base")),
            h.Value(model.editHistoryNameInput),
            h.Placeholder(templateName === "" ? "Session name" : templateName),
            h.Autocomplete("off"),
            h.Autocapitalize("words"),
            h.EnterKeyHint("done"),
            h.Autofocus(true),
            h.OnInput((value) => Message.ChangedEditHistoryName({ text: value })),
            h.OnKeyDownPreventDefault((key) =>
              key === "Enter" ? Option.some(Message.ConfirmedEditHistoryName()) : Option.none(),
            ),
          ]),
          h.p(
            [h.Class("text-[0.8125rem] leading-snug text-muted-foreground")],
            [
              templateName === ""
                ? "Leave it empty to use the template name."
                : `Leave it empty to call it “${templateName}”.`,
            ],
          ),
        ],
      ),
    ],
    h,
  );
};
