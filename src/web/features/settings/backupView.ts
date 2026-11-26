import type { H, Ui } from "@/lib/view";

import { Download, FileText, groupedList, icon, notice } from "@/components/app";
import { button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Message } from "../../../messages";
import { confirmSheet } from "../../sheets";

// Settings → Backup: download every template and finished session as a file,
// or restore such a file. Restoring only adds what is missing.

/** The file input RestoreBackup reads; Settings renders it once. */
export const backupInputId = "settings-backup-file";

type BackupModel = Readonly<{
  backupBusy: boolean;
  pendingStorageReset: boolean;
  backupNotice: { readonly tone: "success" | "error"; readonly text: string } | null;
}>;

/** A label styled as a button: it opens the visually hidden file picker. */
const restoreControl = (busy: boolean, h: H<Message>): Ui =>
  h.label
    .class(
      cn(
        buttonClass({ variant: "outline", className: "relative w-full sm:w-auto" }),
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        busy && "pointer-events-none opacity-50",
      ),
    )
    .children(
      icon(h, FileText, "size-4"),
      "Restore from backup",
      h.input
        .id(backupInputId)
        .attr("type", "file")
        .attr("accept", "application/json,.json")
        .class("sr-only")
        .disabled(busy && true)
        .on("change", () => Message.ChoseBackupFile()),
    );

export const backupSection = (model: BackupModel, h: H<Message>): Ui =>
  groupedList(
    {
      header: "Backup",
      footer:
        "A backup file holds every template and finished session. Restoring adds what's missing and never changes or deletes what's already here.",
    },
    [
      h.div.class("flex flex-col gap-3 p-4").children(
        h.div.class("flex flex-col gap-2 sm:flex-row").children(
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
        ),
        button(
          {
            variant: "ghost",
            className: "w-full justify-start text-destructive sm:w-auto",
            isDisabled: model.backupBusy,
            onClick: Message.ClickedResetStorage(),
          },
          "Reset storage in this browser",
          h,
        ),
        model.backupNotice === null
          ? []
          : [
              notice(
                {
                  tone: model.backupNotice.tone === "error" ? "error" : "info",
                  text: model.backupNotice.text,
                },
                h,
              ),
            ],
      ),
    ],
    h,
  );

/**
 * Last resort when saving keeps failing after a reload: erase this browser's
 * store, then restore a backup. Rendered once, outside the settings columns.
 */
export const resetStorageSheet = (model: BackupModel, h: H<Message>): ReadonlyArray<Ui> =>
  model.pendingStorageReset
    ? [
        confirmSheet(
          {
            id: "reset-storage",
            title: "Erase studies in this browser?",
            message:
              "Every template and session stored here is deleted and Optio reloads. Download a backup first, then restore it afterwards. Close other Optio tabs before continuing.",
            confirmLabel: "Erase and reload",
            cancelLabel: "Keep my studies",
            destructive: true,
            onConfirm: Message.ConfirmedResetStorage(),
            onCancel: Message.CanceledResetStorage(),
          },
          h,
        ),
      ]
    : [];
