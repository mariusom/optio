import type { Update } from "foldkit";

import { restoreSummary } from "../web/backup";
import { DownloadBackup, RestoreBackup } from "../web/features/settings/backupCommands";
import { backupInputId } from "../web/features/settings/backupView";
import type { Message, MessageHandlers } from "../messages";
import type { Model } from "./model";

type Result = Update.Return<Model, Message>;
type BackupHandlers = Pick<
  MessageHandlers<Result>,
  | "ClickedDownloadBackup"
  | "BackupDownloaded"
  | "ChoseBackupFile"
  | "BackupRestored"
  | "FailedBackup"
>;

const done = (model: Model, tone: "success" | "error", text: string): Result => ({
  model: { ...model, backupBusy: false, backupNotice: { tone, text } },
});

/** Settings' backup download and restore; storage writes happen in the commands. */
export const backupHandlers = (model: Model): BackupHandlers => ({
  ClickedDownloadBackup: () => ({
    model: { ...model, backupBusy: true, backupNotice: null },
    commands: [DownloadBackup()],
  }),
  BackupDownloaded: ({ filename }) => done(model, "success", `Saved ${filename}.`),
  ChoseBackupFile: () => ({
    model: { ...model, backupBusy: true, backupNotice: null },
    commands: [RestoreBackup({ inputId: backupInputId })],
  }),
  BackupRestored: (counts) => done(model, "success", restoreSummary(counts)),
  FailedBackup: ({ error }) => done(model, "error", error),
});
