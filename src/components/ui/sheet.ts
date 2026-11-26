// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { Button } from "@effect/ui-kit";
import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

// A sheet is a modal native <dialog> anchored to an edge of the viewport
// instead of centered. Plain Effect UI view: the caller's Model owns `isOpen`.

/** The sheet's title element id, derived from its base id. */
export const titleId = (id: string): string => `${id}-dialog-title`;

/** The sheet's description element id, derived from its base id. */
export const descriptionId = (id: string): string => `${id}-dialog-description`;

// Delta from upstream: upstream keys enter/exit motion on
// data-starting-style/data-ending-style; the equivalent declarations are
// inlined under data-enter/data-leave, and the panel emits data-side (from
// the `side` view input).

export type SheetSide = "top" | "bottom" | "left" | "right";

/** Upstream SheetContent string. Positioning comes from the cn-sheet-content
 *  token keyed on the emitted data-side attribute. */
export const sheetPanelClass: Readonly<Record<SheetSide, string>> = {
  top: "bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-enter:opacity-0 data-leave:opacity-0 data-[side=bottom]:data-enter:translate-y-[2.5rem] data-[side=bottom]:data-leave:translate-y-[2.5rem] data-[side=left]:data-enter:translate-x-[-2.5rem] data-[side=left]:data-leave:translate-x-[-2.5rem] data-[side=right]:data-enter:translate-x-[2.5rem] data-[side=right]:data-leave:translate-x-[2.5rem] data-[side=top]:data-enter:translate-y-[-2.5rem] data-[side=top]:data-leave:translate-y-[-2.5rem]",
  bottom:
    "bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-enter:opacity-0 data-leave:opacity-0 data-[side=bottom]:data-enter:translate-y-[2.5rem] data-[side=bottom]:data-leave:translate-y-[2.5rem] data-[side=left]:data-enter:translate-x-[-2.5rem] data-[side=left]:data-leave:translate-x-[-2.5rem] data-[side=right]:data-enter:translate-x-[2.5rem] data-[side=right]:data-leave:translate-x-[2.5rem] data-[side=top]:data-enter:translate-y-[-2.5rem] data-[side=top]:data-leave:translate-y-[-2.5rem]",
  left: "bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-enter:opacity-0 data-leave:opacity-0 data-[side=bottom]:data-enter:translate-y-[2.5rem] data-[side=bottom]:data-leave:translate-y-[2.5rem] data-[side=left]:data-enter:translate-x-[-2.5rem] data-[side=left]:data-leave:translate-x-[-2.5rem] data-[side=right]:data-enter:translate-x-[2.5rem] data-[side=right]:data-leave:translate-x-[2.5rem] data-[side=top]:data-enter:translate-y-[-2.5rem] data-[side=top]:data-leave:translate-y-[-2.5rem]",
  right:
    "bg-popover text-popover-foreground fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-enter:opacity-0 data-leave:opacity-0 data-[side=bottom]:data-enter:translate-y-[2.5rem] data-[side=bottom]:data-leave:translate-y-[2.5rem] data-[side=left]:data-enter:translate-x-[-2.5rem] data-[side=left]:data-leave:translate-x-[-2.5rem] data-[side=right]:data-enter:translate-x-[2.5rem] data-[side=right]:data-leave:translate-x-[2.5rem] data-[side=top]:data-enter:translate-y-[-2.5rem] data-[side=top]:data-leave:translate-y-[-2.5rem]",
};

/** Upstream motion classes (data-starting-style/data-ending-style variants);
 *  data-enter/data-leave equivalents are added to the same tokens at style
 *  resolution. */
export const sheetMotionClass =
  "data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]";

export const sheetBackdropClass =
  "bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-enter:opacity-0 data-leave:opacity-0 fixed inset-0 z-50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0";

export const sheetHeaderClass = "gap-0.5 p-4 flex flex-col";

export const sheetFooterClass = "gap-2 p-4 mt-auto flex flex-col";

export const sheetTitleClass = "text-foreground text-base font-medium font-heading";

export const sheetDescriptionClass = "text-muted-foreground text-sm";

/** Upstream renders close via `<Button variant="ghost" size="icon-sm">`. */
export const sheetCloseButtonClass =
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-3 aria-invalid:ring-3 active:not-aria-[haspopup]:translate-y-px [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg absolute top-3 right-3";

type StyleConfig = Readonly<{
  className?: string;
  /** Extra attributes on the element (ids, ARIA). */
  attrs?: Readonly<Record<string, string | undefined>>;
}>;

export const header = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "sheet-header" })
    .class(cn(sheetHeaderClass, config.className))
    .children(children);

/** Sheet title — pass `attrs: { id: render.titleId }`. */
export const title = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.h2
    .attrs({ ...config.attrs, "data-slot": "sheet-title" })
    .class(cn(sheetTitleClass, config.className))
    .children(children);

/** Sheet description — pass `attrs: { id: render.descriptionId }`. */
export const description = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.p
    .attrs({ ...config.attrs, "data-slot": "sheet-description" })
    .class(cn(sheetDescriptionClass, config.className))
    .children(children);

export const footer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attrs({ ...config.attrs, "data-slot": "sheet-footer" })
    .class(cn(sheetFooterClass, config.className))
    .children(children);

/** Close button on the @effect/ui-kit Button; `onClick` is usually the
 *  sheet's `onClose`. */
export const closeButton = <M>(
  config: StyleConfig & Readonly<{ onClick?: M }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  Button(h, config.onClick === undefined ? {} : { onPress: config.onClick })
    .attrs({ ...config.attrs, "data-slot": "sheet-close" })
    .class(cn(sheetCloseButtonClass, config.className))
    .children(children);

/** Ids the content callback wires onto its title and description. */
export type SheetContent = Readonly<{ titleId: string; descriptionId: string }>;

export type ViewConfig<M> = Readonly<{
  /** DOM id of the <dialog>; the title and description ids derive from it. */
  id: string;
  /** Shows the sheet as a modal while true. */
  isOpen: boolean;
  /** Sent on a close request (Escape) or a backdrop tap. */
  onClose?: M;
  /** Set when content renders the description element; adds aria-describedby. */
  hasDescription?: boolean;
  side?: SheetSide;
  content: (render: SheetContent, h: H<M>) => ReadonlyArray<Child>;
  className?: string;
  backdropClass?: string;
  panelClass?: string;
  /** Extra attributes merged onto the panel (e.g. data-mobile for sidebar). */
  panelAttrs?: Readonly<Record<string, string | undefined>>;
}>;

/** Styled sheet on a native modal <dialog>. Defaults to a right-side panel. */
export const view = <M>(config: ViewConfig<M>, h: H<M>): Ui => {
  const side = config.side ?? "right";
  const render: SheetContent = {
    titleId: titleId(config.id),
    descriptionId: descriptionId(config.id),
  };
  const dialog = h.dialog
    .id(config.id)
    .modal(config.isOpen)
    .attrs({
      "aria-labelledby": render.titleId,
      "aria-describedby": config.hasDescription === true ? render.descriptionId : undefined,
      "data-slot": "sheet",
    })
    .class(cn("bg-transparent p-0 open:block", config.className));
  const backdrop = h.div
    .attr("data-slot", "sheet-overlay")
    .class(cn(sheetBackdropClass, config.backdropClass));
  return (config.onClose === undefined ? dialog : dialog.on("cancel", config.onClose)).children(
    config.isOpen
      ? [
          config.onClose === undefined ? backdrop : backdrop.on("click", config.onClose),
          h.div
            .attrs({ ...config.panelAttrs, "data-slot": "sheet-content", "data-side": side })
            .class(cn(sheetPanelClass[side], sheetMotionClass, config.panelClass))
            .children(config.content(render, h)),
        ]
      : [],
  );
};
