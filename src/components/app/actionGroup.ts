import type { H } from "@/lib/view";

import { button } from "@/components/ui/button";

type Action<M> = Readonly<{
  label: string;
  onClick: M;
  ariaLabel?: string;
  isDisabled?: boolean;
  /** `aria-keyshortcuts` value when a keyboard shortcut triggers the action. */
  keyShortcuts?: string;
}>;

export type ActionGroupConfig<M> = Readonly<{
  destructive?: Action<M>;
  cancel?: Action<M>;
  confirm?: Action<M>;
}>;

/** Destructive action left; Cancel then confirmation right, in visual and tab order. */
export const actionGroup = <M>(config: ActionGroupConfig<M>, h: H<M>) => {
  const action = (value: Action<M>, variant: "destructive" | "secondary" | "default") =>
    button(
      {
        // Destructive stays an outline beside the filled confirmation: one loud action.
        variant: variant === "destructive" ? "outline" : variant,
        className:
          variant === "destructive" ? "text-destructive hover:text-destructive" : undefined,
        size: "lg",
        onClick: value.onClick,
        isDisabled: value.isDisabled,
        attrs: {
          "aria-label": value.ariaLabel ?? value.label,
          "aria-keyshortcuts": !(value.keyShortcuts === undefined) ? value.keyShortcuts : undefined,
        },
      },
      value.label,
      h,
    );
  return h.div
    .class("flex w-full flex-wrap items-center justify-between gap-3")
    .attr("data-slot", "action-group")
    .children(
      config.destructive === undefined ? [] : [action(config.destructive, "destructive")],
      h.div
        .class("ml-auto flex flex-wrap items-center justify-end gap-2")
        .children(
          config.cancel === undefined ? [] : [action(config.cancel, "secondary")],
          config.confirm === undefined ? [] : [action(config.confirm, "default")],
        ),
    );
};
