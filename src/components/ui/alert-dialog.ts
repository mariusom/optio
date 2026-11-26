// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { Button } from "@effect/ui-kit";
import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

// An alert dialog is a modal native <dialog> with destructive-confirm styling
// and role="alertdialog". Plain Effect UI view: the caller's Model owns
// `isOpen`.
//
// foldcn gaps vs upstream: no Media part slot wiring in `view` (use
// AlertDialog.media inside content), and Action/Cancel compose Button tokens
// instead of rendering the Button component.

/** The alert dialog's title element id, derived from its base id. */
export const titleId = (id: string): string => `${id}-dialog-title`;

/** The alert dialog's description element id, derived from its base id. */
export const descriptionId = (id: string): string => `${id}-dialog-description`;

/** Delta from upstream: host <dialog> element chrome (upstream Root renders
 *  nothing). See dialog.ts. */
export const alertDialogClass = "bg-transparent p-0 open:flex items-center justify-center";

export const alertDialogBackdropClass =
  "data-enter:animate-in data-leave:animate-out data-leave:fade-out-0 data-enter:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50";

/** Upstream content string. The `data-size` attr ("default" | "sm") keys the
 *  cn-alert-dialog-content token's max-width variants. */
export const alertDialogPanelClass =
  "data-enter:animate-in data-leave:animate-out data-leave:fade-out-0 data-enter:fade-in-0 data-leave:zoom-out-95 data-enter:zoom-in-95 bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-xl p-4 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none";

export const alertDialogMediaClass =
  "bg-muted mb-2 inline-flex size-10 items-center justify-center rounded-md sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6";

export const alertDialogTitleClass =
  "text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2 font-heading";

export const alertDialogDescriptionClass =
  "text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3";

export const alertDialogHeaderClass =
  "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]";

export const alertDialogFooterClass =
  "bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end";

/** Upstream renders Cancel via `<Button variant="outline" size="default">`. */
export const alertDialogCancelClass =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2";

/** Upstream renders Action via `<Button>` (default variant). */
export const alertDialogActionClass =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/80 h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2";

/** foldcn extra (upstream alert-dialog has no close X): ghost icon button,
 *  kept for backward compatibility with the closeButton helper. */
export const alertDialogCloseButtonClass =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg";

type StyleConfig = Readonly<{
  className?: string;
  /** Extra attributes on the element (ids, ARIA). */
  attrs?: Readonly<Record<string, string | undefined>>;
}>;

type ButtonConfig<M> = StyleConfig & Readonly<{ onClick?: M }>;

/** Alert dialog header wrapper. */
export const header = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "alert-dialog-header" })
    .class(cn(alertDialogHeaderClass, config.className))
    .children(children);

/** Media slot — icon/media area above the title (upstream AlertDialogMedia). */
export const media = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "alert-dialog-media" })
    .class(cn(alertDialogMediaClass, config.className))
    .children(children);

/** Alert dialog title — pass `attrs: { id: render.titleId }`. */
export const title = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.h2
    .attrs({ ...config.attrs, "data-slot": "alert-dialog-title" })
    .class(cn(alertDialogTitleClass, config.className))
    .children(children);

/** Alert dialog description — pass `attrs: { id: render.descriptionId }`. */
export const description = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.p
    .attrs({ ...config.attrs, "data-slot": "alert-dialog-description" })
    .class(cn(alertDialogDescriptionClass, config.className))
    .children(children);

/** Alert dialog footer wrapper. */
export const footer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "alert-dialog-footer" })
    .class(cn(alertDialogFooterClass, config.className))
    .children(children);

/** A footer button builder for one slot and its classes. */
const dialogButton =
  (slot: string, className: string) =>
  <M>(config: ButtonConfig<M>, children: ReadonlyArray<Child>, h: H<M>): Ui =>
    Button(h, config.onClick === undefined ? {} : { onPress: config.onClick })
      .attrs({ ...config.attrs, "data-slot": slot })
      .class(cn(className, config.className))
      .children(children);

/** Close button on the @effect/ui-kit Button. */
export const closeButton = <M>(
  config: ButtonConfig<M>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui => dialogButton("alert-dialog-close", alertDialogCloseButtonClass)(config, children, h);

/** Destructive action button. Its `onClick` should confirm and close. */
export const actionButton = <M>(
  config: ButtonConfig<M>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui => dialogButton("alert-dialog-action", alertDialogActionClass)(config, children, h);

/** Secondary cancel button. */
export const cancelButton = <M>(
  config: ButtonConfig<M>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui => dialogButton("alert-dialog-cancel", alertDialogCancelClass)(config, children, h);

/** Ids the content callback wires onto its title and description. */
export type AlertDialogContent = Readonly<{ titleId: string; descriptionId: string }>;

export type ViewConfig<M> = Readonly<{
  /** DOM id of the <dialog>; the title and description ids derive from it. */
  id: string;
  /** Shows the alert dialog as a modal while true. */
  isOpen: boolean;
  /** Sent on a close request (Escape) or a backdrop tap. */
  onClose?: M;
  /** Set when content renders the description element; adds aria-describedby. */
  hasDescription?: boolean;
  content: (render: AlertDialogContent, h: H<M>) => ReadonlyArray<Child>;
  className?: string;
  backdropClass?: string;
  panelClass?: string;
  /** Upstream Content `size` prop ("default" | "sm"); keys the panel token's
   *  max-width variants via data-size. */
  size?: "default" | "sm";
}>;

/** Styled alert dialog on a native modal <dialog>. */
export const view = <M>(config: ViewConfig<M>, h: H<M>): Ui => {
  const render: AlertDialogContent = {
    titleId: titleId(config.id),
    descriptionId: descriptionId(config.id),
  };
  const dialog = h.dialog
    .id(config.id)
    .modal(config.isOpen)
    .attrs({
      role: "alertdialog",
      "aria-labelledby": render.titleId,
      "aria-describedby": config.hasDescription === true ? render.descriptionId : undefined,
      "data-slot": "alert-dialog",
    })
    .class(cn(alertDialogClass, config.className));
  const backdrop = h.div
    .attr("data-slot", "alert-dialog-overlay")
    .class(cn(alertDialogBackdropClass, config.backdropClass));
  return (config.onClose === undefined ? dialog : dialog.on("cancel", config.onClose)).children(
    config.isOpen
      ? [
          config.onClose === undefined ? backdrop : backdrop.on("click", config.onClose),
          h.div
            .attr("data-slot", "alert-dialog-content")
            .attr("data-size", config.size ?? "default")
            .class(cn(alertDialogPanelClass, config.panelClass))
            .children(config.content(render, h)),
        ]
      : [],
  );
};
