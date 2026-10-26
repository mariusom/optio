import { Effect } from "effect";
import { Command } from "foldkit";

import { storageResetKey } from "../livestore/resetFlag";
import { Message } from "../messages";

/**
 * Erases this browser's studies and reloads: the next store open uses
 * LiveStore's `resetPersistence` once. Settings only offers it behind a
 * confirmation that asks for a backup first.
 */
export const ResetLocalStorage = Command.define("ResetLocalStorage", {
  messages: [Message.Navigated],
  execute: Effect.sync(() => {
    localStorage.setItem(storageResetKey, "1");
    window.location.reload();
  }).pipe(Effect.ignoreCause, Effect.as(Message.Navigated())),
});
