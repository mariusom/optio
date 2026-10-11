import { Effect, Queue, Stream } from "effect";
import { Command } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Message } from "../messages";
import { withStore } from "../livestore/access";
import { serialized } from "./features/session/writeLock";
import { confirmedOnDisk } from "./storeDurability";
import { onUpdateReady } from "./updateSignal";

// Optio never reloads the page out from under the user: a new version waits
// for an explicit tap, so an update cannot interrupt a recording.

/**
 * Reports when a new version has taken control. The entry registers the
 * service worker before the app starts (so it installs even if the app fails
 * to boot); the PWA plugin's `autoUpdate` mode activates the new worker at
 * once, and applying it is a reload.
 */
export const appUpdates: Stream.Stream<Message> = Stream.callback<Message>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => onUpdateReady(() => Queue.offerUnsafe(queue, Message.AppUpdateReady()))),
    (unsubscribe) => Effect.sync(unsubscribe),
  ).pipe(Effect.andThen(Effect.never)),
);

/** Loads the new version. Pending answers flush on `beforeunload`, as on any reload. */
/** Longest wait for pending answers to reach disk before reloading anyway. */
const flushWait = "3 seconds";

/**
 * Reloads into the new version once pending answers are on disk. It queues
 * behind runner writes (the flush update issued just before it), then waits
 * for the leader to confirm them; a store that is unavailable or slow never
 * blocks the update beyond the short wait.
 */
export const ReloadForUpdate = Command.define("ReloadForUpdate", {
  messages: [Message.Navigated],
  execute: withStore(({ store }) => confirmedOnDisk(store, flushWait)).pipe(
    serialized,
    Effect.catchCause(() => Effect.void),
    Effect.andThen(Effect.sync(() => window.location.reload())),
    Effect.as(Message.Navigated()),
  ),
});

/**
 * The "Update ready" prompt, pinned above the page until it is tapped. A status
 * region announces it; the button inside keeps its button role.
 */
export const appUpdatePrompt = (
  status: "none" | "ready" | "applying",
  h: HtmlBuilder<Message>,
): Html | null =>
  status === "none"
    ? null
    : h.div(
        [
          h.Role("status"),
          h.Class(
            "fixed top-[calc(0.75rem+env(safe-area-inset-top))] left-1/2 z-[60] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 animate-[toast-in_0.25s_ease-out]",
          ),
        ],
        [
          h.button(
            [
              h.Type("button"),
              h.Class(
                "min-h-11 w-full rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-80",
              ),
              // Disabled after the first tap so a double tap cannot reload twice.
              h.Disabled(status === "applying"),
              h.OnClick(Message.ClickedApplyUpdate()),
            ],
            [status === "applying" ? "Loading update…" : "Update ready. Tap to refresh."],
          ),
        ],
      );
