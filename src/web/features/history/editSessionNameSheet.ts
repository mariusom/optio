import type { H } from "@/lib/view";

import { sheet } from "@/components/app";
import { inlineFieldClass, inputClass, inputLabelClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";

type EditModel = {
  readonly showEditHistoryName: boolean;
  readonly editHistoryNameInput: string;
  readonly selectedHistorySession: {
    readonly templateName: string;
  } | null;
};

export const editSessionNameSheet = (model: EditModel, h: H<Message>) => {
  if (!model.showEditHistoryName) return h.div;
  const templateName = model.selectedHistorySession?.templateName ?? "";
  return sheet(
    {
      id: "edit-session-name",
      title: "Session name",
      onDismiss: Message.CanceledEditHistoryName(),
      size: "md",
      footer: {
        cancel: {
          label: "Cancel",
          onClick: Message.CanceledEditHistoryName(),
          ariaLabel: "Cancel editing session name",
        },
        confirm: {
          label: "Save",
          onClick: Message.ConfirmedEditHistoryName(),
          ariaLabel: "Save session name",
        },
      },
    },
    [
      h.div.class(cn(inlineFieldClass, "py-1")).children(
        h.label.attr("for", "edit-session-name-input").class(cn(inputLabelClass)).children("Name"),
        h.input
          .id("edit-session-name-input")
          .attr("type", "text")
          .class(cn(inputClass))
          .value(model.editHistoryNameInput)
          .attr("placeholder", templateName === "" ? "Session name" : templateName)
          .attr("autocomplete", "off")
          .attr("autocapitalize", "words")
          .attr("enterkeyhint", "done")
          .attr("autofocus", "")
          .on("input", ({ value }) => Message.ChangedEditHistoryName({ text: value }))
          .on(
            "keydown",
            ({ key }) => (key === "Enter" ? Message.ConfirmedEditHistoryName() : undefined),
            { preventDefault: true },
          ),
        h.p
          .class("col-span-2 text-xs leading-snug text-muted-foreground")
          .children(
            templateName === ""
              ? "Leave it empty to use the template name."
              : `Leave it empty to call it “${templateName}”.`,
          ),
      ),
    ],
    h,
  );
};
