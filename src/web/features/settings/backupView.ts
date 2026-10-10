import type { Html, HtmlBuilder } from "foldkit/html";

import { Download, FileText, groupedList, icon, notice } from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";

// Settings → Backup: download every template and finished session as a file,
// or restore such a file. Restoring only adds what is missing.

/** The file input RestoreBackup reads; Settings renders it once. */
export const backupInputId = "settings-backup-file";

type BackupModel = Readonly<{
  backupBusy: boolean;
  backupNotice: { readonly tone: "success" | "error"; readonly text: string } | null;
}>;

/** A label styled as a button: it opens the visually hidden file picker. */
const restoreControl = (busy: boolean, h: HtmlBuilder<Message>): Html =>
  h.label(
    [
      h.Class(
        cn(
          buttonClass({ variant: "outline", className: "relative w-full sm:w-auto" }),
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          busy && "pointer-events-none opacity-50",
        ),
      ),
    ],
    [
      icon(h, FileText, "size-4"),
      "Restore from backup",
      h.input([
        h.Id(backupInputId),
        h.Type("file"),
        h.Accept("application/json,.json"),
        h.Class("sr-only"),
        ...(busy ? [h.Disabled(true)] : []),
        h.OnChange(() => Message.ChoseBackupFile()),
      ]),
    ],
  );

export const backupSection = (model: BackupModel, h: HtmlBuilder<Message>): Html =>
  groupedList(
    {
      header: "Backup",
      footer:
        "A backup file holds every template and finished session. Restoring adds what's missing and never changes or deletes what's already here.",
    },
    [
      h.div(
        [h.Class("flex flex-col gap-3 p-4")],
        [
          h.div(
            [h.Class("flex flex-col gap-2 sm:flex-row")],
            [
              button(
                {
                  variant: "outline",
                  className: "w-full sm:w-auto",
                  isDisabled: model.backupBusy,
                  onClick: Message.ClickedDownloadBackup(),
                },
                [icon(h, Download, "size-4"), "Download backup"],
                h,
              ),
              restoreControl(model.backupBusy, h),
            ],
          ),
          ...(model.backupNotice === null
            ? []
            : [
                notice(
                  {
                    tone: model.backupNotice.tone === "error" ? "error" : "info",
                    text: model.backupNotice.text,
                  },
                  h,
                ),
              ]),
        ],
      ),
    ],
    h,
  );
