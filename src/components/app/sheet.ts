import { Effect, Schema } from "effect";
import * as Dom from "foldkit/dom";
import type { Html, HtmlBuilder } from "foldkit/html";
import * as Mount from "foldkit/mount";

import { button } from "@/components/ui/button";
import * as Dialog from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { actionGroup, type ActionGroupConfig } from "./actionGroup";

type Child = Html | string;

export type SheetConfig<M> = Readonly<{
  /** Unique DOM id of the dialog; its title and description ids derive from it. */
  id: string;
  title: string;
  description?: Child;
  /** Message sent when the backdrop is tapped or Escape is pressed. */
  onDismiss: M;
  /** No-op acknowledgement for the sheet's lifecycle effects (show, unmount). */
  onSettled: M;
  /** Standard destructive / cancel / confirm action groups. */
  footer?: ActionGroupConfig<M>;
  /** Wider panel on large screens (forms). */
  size?: "sm" | "md";
  className?: string;
}>;

// ── Lifecycle ──────────────────────────────────────────────────────────────
//
// A sheet is open exactly while its page renders it, so the page model stays
// the only open/closed state. Mounting the <dialog> shows it through FoldKit's
// dialog helpers (focus entry, Tab trap, topmost-only Escape, scroll lock);
// unmounting releases them. Focus returns to whatever opened the first sheet
// once the last one closes: one render can swap sheets (actions →
// confirmation), and Mount releases run asynchronously, so the opener is kept
// for the whole run of open sheets rather than per dialog.

let openSheets = 0;
let opener: HTMLElement | null = null;

const ShowedSheet = Schema.TaggedStruct("ShowedSheet", {});

// Mounted on the sheet's <dialog>, whose id the Dialog view sets.
export const ShowSheet = Mount.define("ShowSheet", {
  messages: [ShowedSheet],
  execute: ({ element: { id } }) =>
    Effect.acquireRelease(
      Effect.gen(function* () {
        const active = document.activeElement;
        if (openSheets === 0) {
          opener = active instanceof HTMLElement && active !== document.body ? active : null;
        }
        openSheets += 1;
        // Dom.showDialog would record and later refocus the active element;
        // focus restoration is owned above, so give it nothing to record.
        if (active instanceof HTMLElement) active.blur();
        yield* Dom.lockScroll;
        yield* Dom.showDialog(`#${CSS.escape(id)}`, { focusSelector: "[autofocus]" }).pipe(
          Effect.catch(() => Dom.unlockScroll),
        );
      }),
      () =>
        Dom.releaseDialogResources(id).pipe(
          Effect.andThen(
            Effect.sync(() => {
              openSheets = Math.max(0, openSheets - 1);
              if (openSheets > 0) return;
              const target = opener;
              opener = null;
              if (target?.isConnected) target.focus({ preventScroll: true });
            }),
          ),
        ),
    ).pipe(Effect.as(ShowedSheet.make({}))),
});

// ── View ───────────────────────────────────────────────────────────────────

/**
 * Modal sheet: slides up from the bottom on phones, centered card on larger
 * screens (SwiftUI `.sheet` / `.confirmationDialog`). Rendered through the
 * @foldkit/ui Dialog view on a native <dialog>; open while rendered.
 */
export const sheet = <M>(
  config: SheetConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.submodel({
    slotId: config.id,
    // Open while rendered: the Mount below shows it, so no open Commands run.
    model: { ...Dialog.init({ id: config.id, isAnimated: false }), isOpen: true },
    view: Dialog.view,
    toParentMessage: (message) =>
      message._tag === "RequestedClose" ? config.onDismiss : config.onSettled,
    viewInputs: {
      hasDescription: config.description !== undefined,
      // Keyed by id: two sheets in the same slot (actions → confirmation) are
      // different dialogs, each shown and released on its own.
      toView: (render) =>
        h.keyed("dialog")(
          config.id,
          [
            ...render.dialog,
            h.AriaModal(true),
            h.DataAttribute("slot", "sheet"),
            h.Class(
              "m-0 items-end justify-center overflow-hidden bg-transparent p-0 text-foreground open:flex sm:items-center",
            ),
            h.OnMount(Mount.mapMessage(ShowSheet(), () => config.onSettled)),
          ],
          [
            h.div([
              ...render.backdrop,
              h.DataAttribute("slot", "sheet-overlay"),
              h.Class(
                "modal-backdrop absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-150",
              ),
            ]),
            h.div(
              [
                ...render.panel,
                h.DataAttribute("slot", "sheet-content"),
                h.Class(
                  cn(
                    "relative flex w-full max-h-[calc(100dvh-3rem)] flex-col overflow-hidden bg-popover text-popover-foreground shadow-xl",
                    "rounded-t-lg pb-safe animate-in slide-in-from-bottom-4 fade-in-0 duration-200",
                    "sm:rounded-lg sm:border sm:border-border sm:zoom-in-95 sm:slide-in-from-bottom-0",
                    config.size === "md" ? "sm:max-w-lg" : "sm:max-w-sm",
                    config.className,
                  ),
                ),
              ],
              [
                h.div([
                  h.Class("mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/30 sm:hidden"),
                  h.AriaHidden(true),
                ]),
                h.div(
                  [h.Class("flex flex-col gap-2 p-6 text-left")],
                  [
                    h.h2(
                      [...render.title, h.Class("text-lg font-semibold tracking-tight")],
                      [config.title],
                    ),
                    ...(config.description === undefined
                      ? []
                      : [
                          h.p(
                            [
                              ...render.description,
                              h.Class("text-sm leading-snug text-muted-foreground"),
                            ],
                            [config.description],
                          ),
                        ]),
                  ],
                ),
                // Confirmations have no body: their actions follow the description.
                ...(children.length === 0
                  ? []
                  : [
                      // Keep outer Card rings inside the scrollport instead of clipping their top/bottom edges.
                      h.div(
                        [h.Class("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-1")],
                        children,
                      ),
                    ]),
                ...(config.footer === undefined
                  ? [h.div([h.Class("h-6")])]
                  : [
                      h.div(
                        [h.Class(children.length === 0 ? "px-6 pt-2 pb-6" : "p-6")],
                        [actionGroup(config.footer, h)],
                      ),
                    ]),
              ],
            ),
          ],
        ),
    },
  });

export type ConfirmConfig<M> = Readonly<{
  id: string;
  title: string;
  message: Child;
  confirmLabel: string;
  onConfirm: M;
  onCancel: M;
  onSettled: M;
  cancelLabel?: string;
  destructive?: boolean;
  isConfirmDisabled?: boolean;
  confirmAriaLabel?: string;
  cancelAriaLabel?: string;
}>;

/** Two-choice confirmation (iOS action sheet / alert). */
export const confirmSheet = <M>(config: ConfirmConfig<M>, h: HtmlBuilder<M>): Html =>
  sheet(
    {
      id: config.id,
      title: config.title,
      description: config.message,
      onDismiss: config.onCancel,
      onSettled: config.onSettled,
      footer: {
        [config.destructive ? "destructive" : "confirm"]: {
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
    leading?: Html;
    isDisabled?: boolean;
    ariaLabel?: string;
  }>,
  h: HtmlBuilder<M>,
): Html =>
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
      attributes: [h.AriaLabel(config.ariaLabel ?? config.label)],
    },
    [...(config.leading === undefined ? [] : [config.leading]), config.label],
    h,
  );
