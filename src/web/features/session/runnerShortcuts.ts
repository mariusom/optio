import { Option, Stream } from "effect";
import { fromEventPreventingDefault } from "@/lib/domEvents";
import type { H, Ui } from "@/lib/view";

import { Kbd } from "@/components/ui/kbd";
import { Message } from "../../../messages";

// Desktop keyboard shortcut for the runner's primary action: Ctrl+Enter
// (⌘+Enter on a Mac) records the open task, or saves a task being edited.

/** Announced on the Record and Save buttons (`aria-keyshortcuts`). */
export const primaryShortcut = "Control+Enter Meta+Enter";

/**
 * Ctrl/⌘+Enter without other modifiers, not auto-repeated, not mid-IME
 * composition (including browsers reporting only keyCode 229), and not while
 * a sheet (a modal `<dialog>`) is open.
 */
export const isPrimaryShortcut = (
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "repeat" | "isComposing" | "keyCode"
  >,
  dialogOpen: boolean,
): boolean =>
  event.key === "Enter" &&
  (event.ctrlKey || event.metaKey) &&
  !event.shiftKey &&
  !event.altKey &&
  !event.repeat &&
  !event.isComposing &&
  event.keyCode !== 229 &&
  !dialogOpen;

/** Active only while the runner shows (see `runnerShortcuts` in subscriptions). */
export const primaryShortcutPresses: Stream.Stream<Message> =
  typeof window === "undefined"
    ? Stream.empty
    : fromEventPreventingDefault<KeyboardEvent, Message>(window, "keydown", (event) =>
        isPrimaryShortcut(event, document.querySelector("dialog[open]") !== null)
          ? Option.some(Message.PressedPrimaryShortcut())
          : Option.none(),
      );

/**
 * The in-button hint stays out of the label's layout and accessible name.
 * The button's `aria-keyshortcuts` exposes the shortcut to assistive tech.
 */
export const primaryShortcutHint = (h: H<Message>): Ui =>
  h.span
    .class("absolute right-3 hidden md:pointer-fine:@min-[14rem]:inline-flex")
    .attr("aria-hidden", String(true))
    .children(
      Kbd(
        { className: "border border-current bg-transparent text-primary-foreground" },
        ["Ctrl/⌘ + Enter"],
        h,
      ),
    );
