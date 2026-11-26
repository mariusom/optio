import { Effect } from "effect";
import { Command, Component } from "@effect/ui";

import { storageResetKey } from "../store/resetFlag";

/**
 * Erases this browser's studies and reloads: the next store open deletes
 * the journal once. Settings only offers it behind a
 * confirmation that asks for a backup first.
 */
export const ResetLocalStorage = Command.make("ResetLocalStorage", { args: {} }, () =>
  Effect.sync(() => {
    localStorage.setItem(storageResetKey, "1");
    window.location.reload();
  }).pipe(Effect.ignoreCause, Effect.as(Component.noop)),
);
