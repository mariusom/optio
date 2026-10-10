import { Option, Stream } from "effect";
import { Dom } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Kbd } from "@/components/ui/kbd";
import { Message } from "../../../messages";

// Desktop keyboard shortcut for the runner's primary action: Ctrl+Enter
// (⌘+Enter on a Mac) records the open task, or saves a task being edited.

/** Announced on the Record and Save buttons (`aria-keyshortcuts`). */
export const primaryShortcut = "Control+Enter Meta+Enter";

/**
 * Ctrl/⌘+Enter without other modifiers, not auto-repeated, not mid-IME
 * composition, and not while a sheet (a modal `<dialog>`) is open.
 */
export const isPrimaryShortcut = (
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "repeat" | "isComposing"
  >,
  dialogOpen: boolean,
): boolean =>
  event.key === "Enter" &&
  (event.ctrlKey || event.metaKey) &&
  !event.shiftKey &&
  !event.altKey &&
  !event.repeat &&
  !event.isComposing &&
  !dialogOpen;

/** Active only while the runner shows (see `runnerShortcuts` in subscriptions). */
export const primaryShortcutPresses: Stream.Stream<Message> =
  typeof window === "undefined"
    ? Stream.empty
    : Dom.streamFromEventFilterMapPreventDefault({
        target: window,
        type: "keydown",
        filterMapEvent: (event) =>
          isPrimaryShortcut(event, document.querySelector("dialog[open]") !== null)
            ? Option.some(Message.PressedPrimaryShortcut())
            : Option.none(),
      });

// Key text at 80% foreground: muted text on the muted key is under 4.5:1.
const key = (label: string, h: HtmlBuilder<Message>): Html =>
  Kbd({ className: "text-foreground/80" }, [label], h);

const combo = (modifier: string, h: HtmlBuilder<Message>): Html =>
  Kbd.group({}, [key(modifier, h), key("Enter", h)], h);

/**
 * "Record with Ctrl Enter or ⌘ Enter", shown only with a fine pointer from
 * 768px. Hidden from assistive tech: the button's `aria-keyshortcuts` says it.
 */
export const primaryShortcutHint = (verb: string, h: HtmlBuilder<Message>): Html =>
  h.p(
    [
      h.Class(
        "hidden items-center justify-center gap-1.5 text-xs text-muted-foreground md:pointer-fine:flex",
      ),
      h.AriaHidden(true),
    ],
    [`${verb} with`, combo("Ctrl", h), "or", combo("⌘", h)],
  );
