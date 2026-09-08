import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Child = Html | string;

export type SheetConfig<M> = Readonly<{
  /** Stable id used for aria-labelledby. */
  id: string;
  title: string;
  description?: Child;
  /** Message sent when the backdrop is tapped or Escape is pressed. */
  onDismiss: M;
  /** Accessible name for the backdrop dismiss control. */
  dismissLabel: string;
  /** Footer actions, stacked on phones. */
  footer?: ReadonlyArray<Html>;
  /** Wider panel on large screens (forms). */
  size?: "sm" | "md";
  className?: string;
}>;

/**
 * Modal sheet: slides up from the bottom on phones, centered card on larger
 * screens (SwiftUI `.sheet` / `.confirmationDialog`). Pure view; open/closed
 * state lives in the page model. Styled with the Foldcn sheet tokens.
 */
export const sheet = <M>(
  config: SheetConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => {
  const titleId = `${config.id}-title`;
  return h.div(
    [
      h.Class("fixed inset-0 z-50 flex items-end justify-center sm:items-center"),
      h.Role("dialog"),
      h.AriaModal(true),
      h.AriaLabelledBy(titleId),
      h.OnKeyDownPreventDefault((key) =>
        key === "Escape" ? Option.some(config.onDismiss) : Option.none(),
      ),
      h.DataAttribute("slot", "sheet"),
    ],
    [
      h.button(
        [
          h.Type("button"),
          h.Class(
            "modal-backdrop absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-150",
          ),
          h.AriaLabel(config.dismissLabel),
          h.OnClick(config.onDismiss),
        ],
        [],
      ),
      h.div(
        [
          h.Class(
            cn(
              "relative flex w-full max-h-[calc(100dvh-3rem)] flex-col overflow-hidden bg-popover text-popover-foreground shadow-xl",
              "rounded-t-2xl pb-safe animate-in slide-in-from-bottom-4 fade-in-0 duration-200",
              "sm:rounded-2xl sm:ring-1 sm:ring-foreground/10 sm:zoom-in-95 sm:slide-in-from-bottom-0",
              config.size === "md" ? "sm:max-w-lg" : "sm:max-w-sm",
              config.className,
            ),
          ),
        ],
        [
          h.div(
            [
              h.Class("mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/30 sm:hidden"),
              h.AriaHidden(true),
            ],
            [],
          ),
          h.div(
            [h.Class("flex flex-col gap-1 px-5 pt-4 pb-2 text-center sm:text-left")],
            [
              h.h2(
                [h.Id(titleId), h.Class("text-[1.0625rem] font-semibold tracking-tight")],
                [config.title],
              ),
              ...(config.description === undefined
                ? []
                : [
                    h.p(
                      [h.Class("text-sm leading-snug text-muted-foreground")],
                      [config.description],
                    ),
                  ]),
            ],
          ),
          h.div([h.Class("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2")], children),
          ...(config.footer === undefined || config.footer.length === 0
            ? [h.div([h.Class("h-3")], [])]
            : [
                h.div(
                  [
                    h.Class(
                      "flex flex-col gap-2 px-5 pt-3 pb-4 sm:flex-row-reverse sm:[&>*]:flex-1",
                    ),
                  ],
                  config.footer,
                ),
              ]),
        ],
      ),
    ],
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
  /** Accessible name for the backdrop dismiss control. */
  dismissLabel?: string;
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
      dismissLabel: config.dismissLabel ?? `Cancel: ${config.title}`,
      footer: [
        button(
          {
            variant: config.destructive ? "destructive" : "default",
            size: "lg",
            className: cn(
              "h-11 text-base font-semibold",
              config.destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "",
            ),
            isDisabled: config.isConfirmDisabled,
            onClick: config.onConfirm,
            attributes: [h.AriaLabel(config.confirmAriaLabel ?? config.confirmLabel)],
          },
          config.confirmLabel,
          h,
        ),
        button(
          {
            variant: "secondary",
            size: "lg",
            className: "h-11 text-base",
            onClick: config.onCancel,
            attributes: [h.AriaLabel(config.cancelAriaLabel ?? config.cancelLabel ?? "Cancel")],
          },
          config.cancelLabel ?? "Cancel",
          h,
        ),
      ],
    },
    [],
    h,
  );

/** Full-width action inside an action sheet (iOS confirmationDialog button). */
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
  h.button(
    [
      h.Type("button"),
      h.Class(
        cn(
          "flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[1.0625rem] transition-colors hover:bg-muted active:bg-muted disabled:opacity-40 disabled:pointer-events-none",
          config.destructive === true ? "text-destructive" : "text-foreground",
        ),
      ),
      h.Disabled(config.isDisabled ?? false),
      h.OnClick(config.onClick),
      h.AriaLabel(config.ariaLabel ?? config.label),
    ],
    [...(config.leading === undefined ? [] : [config.leading]), config.label],
  );
