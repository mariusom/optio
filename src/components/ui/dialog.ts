import { Button } from "@effect/ui-kit";
import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

// A plain Effect UI view over a native modal <dialog>: the caller's Model owns
// `isOpen`, and Escape or a backdrop tap sends `onClose`.

/** The dialog's title element id, derived from its base id. */
export const titleId = (id: string): string => `${id}-dialog-title`;

/** The dialog's description element id, derived from its base id. */
export const descriptionId = (id: string): string => `${id}-dialog-description`;

/** Delta from upstream: the host <dialog> element's own chrome (upstream Root
 *  renders nothing). Backdrop/panel are fixed-position; this only neutralizes
 *  the native dialog box. */
export const dialogClass = "bg-transparent p-0 open:flex items-center justify-center";

// The sync script rewrites upstream's `data-open:`/`data-closed:` animation
// utilities to `data-enter`/`data-leave` windows during token sync; persistent
// `data-open:` styling passes through untouched. This view sets neither
// attribute (no animation state), so the panel shows in its resting state.
export const dialogBackdropClass =
  "data-enter:animate-in data-leave:animate-out data-leave:fade-out-0 data-enter:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50";

export const dialogPanelClass =
  "bg-popover text-popover-foreground data-enter:animate-in data-leave:animate-out data-leave:fade-out-0 data-enter:fade-in-0 data-leave:zoom-out-95 data-enter:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-sm ring-1 duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none";

/** Upstream renders its close control as `<Button variant="ghost" size="icon-sm"
 *  className="cn-dialog-close">`; compose the same tokens here. */
export const dialogCloseButtonClass =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg absolute top-2 right-2";

export const dialogTitleClass = "text-base leading-none font-medium font-heading";

export const dialogDescriptionClass =
  "text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3";

export const dialogHeaderClass = "gap-2 flex flex-col";

export const dialogFooterClass =
  "bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";

// Every builder follows one shape: `(config, children, h)`. Use them inside
// the `view` content callback, wiring the ids it hands you:
//
//   content: (render, h) => [
//     Dialog.header({}, [
//       Dialog.title({ attrs: { id: render.titleId } }, ['Title'], h),
//       Dialog.description({ attrs: { id: render.descriptionId } }, ['Subtitle'], h),
//     ], h),
//     Dialog.footer({}, [button(...)], h),
//   ]

type StyleConfig = Readonly<{
  className?: string;
  /** Extra attributes on the element (ids, ARIA). */
  attrs?: Readonly<Record<string, string | undefined>>;
}>;

/** Dialog header wrapper. */
export const header = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "dialog-header" })
    .class(cn(dialogHeaderClass, config.className))
    .children(children);

/** Dialog title — pass `attrs: { id: render.titleId }`. */
export const title = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.h2
    .attrs({ ...config.attrs, "data-slot": "dialog-title" })
    .class(cn(dialogTitleClass, config.className))
    .children(children);

/** Dialog description — pass `attrs: { id: render.descriptionId }`. */
export const description = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.p
    .attrs({ ...config.attrs, "data-slot": "dialog-description" })
    .class(cn(dialogDescriptionClass, config.className))
    .children(children);

/** Dialog footer wrapper. */
export const footer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "dialog-footer" })
    .class(cn(dialogFooterClass, config.className))
    .children(children);

/** Close button on the @effect/ui-kit Button; `onClick` is usually the
 *  dialog's `onClose`. */
export const closeButton = <M>(
  config: StyleConfig & Readonly<{ onClick?: M }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  Button(h, config.onClick === undefined ? {} : { onPress: config.onClick })
    .attrs({ ...config.attrs, "data-slot": "dialog-close" })
    .class(cn(dialogCloseButtonClass, config.className))
    .children(children);

/** Ids the content callback wires onto its title and description. */
export type DialogContent = Readonly<{ titleId: string; descriptionId: string }>;

export type ViewConfig<M> = Readonly<{
  /** DOM id of the <dialog>; the title and description ids derive from it. */
  id: string;
  /** Shows the dialog as a modal while true. */
  isOpen: boolean;
  /** Sent on a close request (Escape) or a backdrop tap. */
  onClose?: M;
  /** Set when content renders the description element; adds aria-describedby. */
  hasDescription?: boolean;
  content: (render: DialogContent, h: H<M>) => ReadonlyArray<Child>;
  className?: string;
  backdropClass?: string;
  panelClass?: string;
}>;

/** Styled modal dialog on a native <dialog>, named by its title and (when
 *  `hasDescription`) described by its description. */
export const view = <M>(config: ViewConfig<M>, h: H<M>): Ui => {
  const render: DialogContent = {
    titleId: titleId(config.id),
    descriptionId: descriptionId(config.id),
  };
  const dialog = h.dialog
    .id(config.id)
    .modal(config.isOpen)
    .attrs({
      "aria-labelledby": render.titleId,
      "aria-describedby": config.hasDescription === true ? render.descriptionId : undefined,
      "data-slot": "dialog",
    })
    .class(cn(dialogClass, config.className));
  const backdrop = h.div
    .attr("data-slot", "dialog-overlay")
    .class(cn(dialogBackdropClass, config.backdropClass));
  return (config.onClose === undefined ? dialog : dialog.on("cancel", config.onClose)).children(
    config.isOpen
      ? [
          config.onClose === undefined ? backdrop : backdrop.on("click", config.onClose),
          h.div
            .attr("data-slot", "dialog-content")
            .class(cn(dialogPanelClass, config.panelClass))
            .children(config.content(render, h)),
        ]
      : [],
  );
};
