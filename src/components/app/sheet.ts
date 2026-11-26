// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { Mount } from "@effect/ui";
import { Effect, Schema, Stream } from "effect";
import type { H, Ui } from "@/lib/view";

import { button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { actionGroup, type ActionGroupConfig } from "./actionGroup";

type Child = Ui | string;

export type SheetConfig<M> = Readonly<{
  /** Unique DOM id of the dialog; its title and description ids derive from it. */
  id: string;
  title: string;
  description?: Child;
  /** Message sent when the backdrop is tapped or Escape is pressed. */
  onDismiss: M;
  /** Standard destructive / cancel / confirm action groups. */
  footer?: ActionGroupConfig<M>;
  /** Wider panel on large screens (forms). */
  size?: "sm" | "md";
  /** "side" slides a full-height panel in from the right edge (task lists). */
  placement?: "bottom" | "side";
  className?: string;
}>;

// ── Lifecycle ──────────────────────────────────────────────────────────────
//
// A sheet is open exactly while its page renders it, so the page model stays
// the only open/closed state. The <dialog> is rendered with `modal(true)`:
// the browser host shows it with `showModal()` at the commit that inserts it
// (top layer, inert page) and closes it before removing it.
// Escape arrives as `cancel`, which the page answers with `onDismiss`.
//
// The mount below adds what the host leaves to the app: focus entry
// (`[autofocus]`, else the first control), Tab wrapping inside the sheet (a
// modal dialog lets Tab leave for the browser's own controls), a page scroll lock (the `main`
// scroller stops through its `has-[[data-slot=sheet]]` class), and focus
// restoration to whatever opened the first of consecutive sheets once the
// last one closes. One render can swap sheets (actions → confirmation) and
// mount releases run after the commit, so the opener is kept for the whole
// run of open sheets rather than per dialog.

let openSheets = 0;
let opener: HTMLElement | null = null;
let savedOverflow = "";
let savedPaddingRight = "";

const controls =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const lockScroll = () => {
  const { documentElement } = document;
  const { style } = documentElement;
  savedOverflow = style.overflow;
  savedPaddingRight = style.paddingRight;
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
  style.overflow = "hidden";
  if (scrollbarWidth > 0) style.paddingRight = `${scrollbarWidth}px`;
};

const unlockScroll = () => {
  const { style } = document.documentElement;
  style.overflow = savedOverflow;
  style.paddingRight = savedPaddingRight;
};

const focusEntry = (node: HTMLDialogElement) => {
  const active = document.activeElement;
  // The browser already focused the [autofocus] control or the first one.
  if (active instanceof HTMLElement && active !== node && node.contains(active)) return;
  const target =
    node.querySelector<HTMLElement>("[autofocus]") ?? node.querySelector<HTMLElement>(controls);
  target?.focus({ preventScroll: true });
};

/** Wraps Tab and Shift+Tab at the sheet's first and last control. */
const wrapTab = (event: KeyboardEvent) => {
  if (event.key !== "Tab" || !(event.currentTarget instanceof HTMLElement)) return;
  const all = [...event.currentTarget.querySelectorAll<HTMLElement>(controls)];
  const first = all[0];
  const last = all.at(-1);
  if (first === undefined || last === undefined) return;
  const edge = event.shiftKey ? first : last;
  if (document.activeElement !== edge && event.currentTarget.contains(document.activeElement))
    return;
  event.preventDefault();
  (event.shiftKey ? last : first).focus();
};

const openSheet = (node: HTMLDialogElement) => {
  if (openSheets === 0) {
    // `showModal()` has usually moved focus inside already, and the browser
    // returns it on close; this keeps the opener for the run of consecutive
    // sheets when focus was still outside.
    const active = document.activeElement;
    opener =
      active instanceof HTMLElement && active !== document.body && !node.contains(active)
        ? active
        : null;
    lockScroll();
  }
  openSheets += 1;
  node.addEventListener("keydown", wrapTab);
  focusEntry(node);
};

const closeSheet = (node: HTMLDialogElement) => {
  node.removeEventListener("keydown", wrapTab);
  openSheets = Math.max(0, openSheets - 1);
  if (openSheets > 0) return;
  unlockScroll();
  const target = opener;
  opener = null;
  const active = document.activeElement;
  const lost = active === null || active === document.body || !active.isConnected;
  if (lost && target !== null && target.isConnected) target.focus({ preventScroll: true });
};

/**
 * Mounted on every sheet's <dialog>: focus entry, Tab wrapping, scroll lock,
 * focus return.
 * A stream that never emits, so its Scope, and the release, lasts exactly as
 * long as the <dialog> element. `id` is the sheet's, naming it in logs and tests.
 */
export const ShowSheet = Mount.makeStream(
  "ShowSheet",
  { args: { id: Schema.String } },
  (node: HTMLDialogElement) => {
    const close = Effect.sync(() => closeSheet(node));
    return Stream.callback<never>(() =>
      Effect.acquireRelease(
        Effect.sync(() => openSheet(node)),
        () => close,
      ),
    );
  },
);

// ── View ───────────────────────────────────────────────────────────────────

/**
 * Modal sheet: slides up from the bottom on phones, centered card on larger
 * screens (SwiftUI `.sheet` / `.confirmationDialog`). A native modal
 * <dialog>, open while rendered.
 */
export const sheet = <M>(config: SheetConfig<M>, children: ReadonlyArray<Child>, h: H<M>): Ui => {
  const titleId = `${config.id}-title`;
  const descriptionId = `${config.id}-description`;
  return (
    h.dialog
      // Keyed by id: two sheets in the same slot (actions → confirmation) are
      // different dialogs, each shown and released on its own.
      .key(config.id)
      .id(config.id)
      .modal(true)
      .attrs({
        "aria-modal": "true",
        "aria-labelledby": titleId,
        "aria-describedby": config.description === undefined ? undefined : descriptionId,
        "data-slot": "sheet",
      })
      .class(
        // Fill the viewport: the browser's modal dialog styles cap its size and
        // `m-0` drops their centring, so the overlay and panel lay out inside.
        "m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-foreground open:flex",
        config.placement === "side"
          ? "items-stretch justify-end"
          : "items-end justify-center sm:items-center",
      )
      .on("cancel", () => config.onDismiss, { preventDefault: true })
      .onMount(ShowSheet({ id: config.id }))
      .children(
        h.div
          .attr("data-slot", "sheet-overlay")
          .class(
            "modal-backdrop absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-150",
          )
          .on("click", config.onDismiss),
        h.div
          .attr("data-slot", "sheet-content")
          .class(
            cn(
              "relative flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-xl",
              config.placement === "side"
                ? "h-full w-[min(22rem,calc(100vw-3rem))] rounded-l-lg border-l border-border pt-safe pb-safe animate-in slide-in-from-right-8 fade-in-0 duration-200"
                : cn(
                    "w-full max-h-[calc(100dvh-3rem)] rounded-t-lg pb-safe animate-in slide-in-from-bottom-4 fade-in-0 duration-200",
                    "sm:rounded-lg sm:border sm:border-border sm:zoom-in-95 sm:slide-in-from-bottom-0",
                    config.size === "md" ? "sm:max-w-lg" : "sm:max-w-sm",
                  ),
              config.className,
            ),
          )
          .children(
            config.placement !== "side" &&
              h.div
                .class("mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/30 sm:hidden")
                .attr("aria-hidden", "true"),
            h.div
              .class("flex flex-col gap-2 p-6 text-left")
              .children(
                h.h2
                  .id(titleId)
                  .class("text-lg font-semibold tracking-tight")
                  .attr("dir", "auto")
                  .children(config.title),
                config.description !== undefined &&
                  h.p
                    .id(descriptionId)
                    .class("text-sm leading-snug text-muted-foreground")
                    .children(config.description),
              ),
            // Confirmations have no body: their actions follow the description.
            children.length > 0 &&
              // Keep outer Card rings inside the scrollport instead of clipping their top/bottom edges.
              h.div
                .class("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-1")
                .children(children),
            config.footer === undefined
              ? h.div.class("h-6")
              : h.div
                  .class(children.length === 0 ? "px-6 pt-2 pb-6" : "p-6")
                  .children(actionGroup(config.footer, h)),
          ),
      )
  );
};

export type ConfirmConfig<M> = Readonly<{
  id: string;
  title: string;
  message: Child;
  confirmLabel: string;
  onConfirm: M;
  onCancel: M;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirmDisabled?: boolean;
  confirmAriaLabel?: string;
  cancelAriaLabel?: string;
}>;

/** Two-choice confirmation (iOS action sheet / alert). */
export const confirmSheet = <M>(config: ConfirmConfig<M>, h: H<M>): Ui =>
  sheet(
    {
      id: config.id,
      title: config.title,
      description: config.message,
      onDismiss: config.onCancel,
      footer: {
        [config.destructive === true ? "destructive" : "confirm"]: {
          label: config.confirmLabel,
          onClick: config.onConfirm,
          isDisabled: config.isConfirmDisabled,
          ariaLabel: config.confirmAriaLabel,
        },
        cancel: {
          label: config.cancelLabel ?? "Cancel",
          onClick: config.onCancel,
          ariaLabel: config.cancelAriaLabel,
        },
      },
    },
    [],
    h,
  );

/**
 * Full-width row inside an action sheet (iOS confirmationDialog button). Every
 * action, destructive included, is a plain row whose label lines up with the
 * sheet title; Cancel lives in the footer.
 */
export const sheetAction = <M>(
  config: Readonly<{
    label: string;
    onClick: M;
    destructive?: boolean;
    leading?: Ui;
    isDisabled?: boolean;
    ariaLabel?: string;
  }>,
  h: H<M>,
): Ui =>
  button(
    {
      variant: "ghost",
      size: "lg",
      className: cn(
        "-mx-3 w-[calc(100%+1.5rem)] justify-start px-3",
        config.destructive &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20",
      ),
      isDisabled: config.isDisabled,
      onClick: config.onClick,
      attrs: { "aria-label": config.ariaLabel ?? config.label },
    },
    [...(config.leading === undefined ? [] : [config.leading]), config.label],
    h,
  );
