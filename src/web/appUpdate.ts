// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { Effect, Queue, Stream } from "effect";
import { Command, Component } from "@effect/ui";
import type { H, Ui } from "@/lib/view";

import { Message } from "../messages";
import { withStore } from "../store/access";
import { serialized } from "../store/writeLock";
import { writesSaved } from "./storeDurability";
import { cn } from "@/lib/utils";
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

/** Longest wait for pending answers to reach disk before reloading anyway. */
const flushWait = "3 seconds";

/**
 * Reloads into the new version once pending answers are on disk. It queues
 * behind runner writes (the flush update issued just before it), then waits
 * for any other write still being saved; a store that is unavailable or slow never
 * blocks the update beyond the short wait.
 */
export const ReloadForUpdate = Command.make("ReloadForUpdate", { args: {} }, () =>
  withStore(({ store }) => writesSaved(store, flushWait)).pipe(
    serialized,
    Effect.catchCause(() => Effect.void),
    Effect.andThen(Effect.sync(() => window.location.reload())),
    Effect.as(Component.noop),
  ),
);

/**
 * The "Update ready" prompt, pinned above the page until it is tapped. A status
 * region announces it; the button inside keeps its button role. Full-screen
 * pages centre their title in a 4rem nav bar, so there it sits just below it.
 */
export const appUpdatePrompt = (
  status: "none" | "ready" | "applying",
  h: H<Message>,
  options: Readonly<{ belowNavBar: boolean }> = { belowNavBar: false },
): Ui | null =>
  status === "none"
    ? null
    : h.div
        .attr("role", "status")
        .class(
          cn(
            "fixed left-1/2 z-[60] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 animate-[toast-in_0.25s_ease-out]",
            options.belowNavBar
              ? "top-[calc(4.75rem+env(safe-area-inset-top))]"
              : "top-[calc(0.75rem+env(safe-area-inset-top))]",
          ),
        )
        .children(
          h.button
            .attr("type", "button")
            .class(
              "min-h-11 w-full rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-80",
            )
            .disabled(status === "applying")
            .on("click", Message.ClickedApplyUpdate())
            .children(status === "applying" ? "Loading update…" : "Update ready. Tap to refresh."),
        );
