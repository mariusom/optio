import { restoreSummary } from "../web/backup";
import { DownloadBackup, RestoreBackup } from "../web/features/settings/backupCommands";
import { backupInputId } from "../web/features/settings/backupView";
import type { MessageHandlers, UpdateResult } from "../messages";
import { ResetLocalStorage } from "../web/storageReset";
import type { Model } from "./model";

type Result = UpdateResult<Model>;
type BackupHandlers = Pick<
  MessageHandlers<Result>,
  | "ClickedDownloadBackup"
  | "SucceededDownloadBackup"
  | "ChoseBackupFile"
  | "SucceededRestoreBackup"
  | "FailedBackup"
  | "ClickedResetStorage"
  | "CanceledResetStorage"
  | "ConfirmedResetStorage"
>;

const done = (model: Model, tone: "success" | "error", text: string): Result => ({
  model: { ...model, backupBusy: false, backupNotice: { tone, text } },
});

/** Settings' backup download and restore; storage writes happen in the commands. */
export const backupHandlers = (model: Model): BackupHandlers => ({
  // A second click (or double-click) while busy must not start another run.
  ClickedDownloadBackup: () =>
    model.backupBusy
      ? { model }
      : {
          model: { ...model, backupBusy: true, backupNotice: null },
          // While saving is stalled the open session is included: it may never reach disk.
          commands: [DownloadBackup.make({ includeOpenSession: model.saveStalled })],
        },
  SucceededDownloadBackup: ({ filename }) => done(model, "success", `Saved ${filename}.`),
  ChoseBackupFile: () =>
    model.backupBusy
      ? { model }
      : {
          model: {
            ...model,
            backupBusy: true,
            backupNotice: {
              tone: "success",
              text: "Restoring… keep Optio open until this finishes.",
            },
          },
          commands: [RestoreBackup.make({ inputId: backupInputId })],
        },
  SucceededRestoreBackup: (counts) => done(model, "success", restoreSummary(counts)),
  FailedBackup: ({ error }) => done(model, "error", error),
  ClickedResetStorage: () => ({ model: { ...model, pendingStorageReset: true } }),
  CanceledResetStorage: () => ({ model: { ...model, pendingStorageReset: false } }),
  ConfirmedResetStorage: () => ({
    model: { ...model, pendingStorageReset: false },
    commands: [ResetLocalStorage.make({})],
  }),
});
