import type { HtmlBuilder } from "foldkit/html";

import { button } from "@/components/ui/button";

type Action<M> = Readonly<{
  label: string;
  onClick: M;
  ariaLabel?: string;
  isDisabled?: boolean;
}>;

export type ActionGroupConfig<M> = Readonly<{
  destructive?: Action<M>;
  cancel?: Action<M>;
  confirm?: Action<M>;
}>;

/** Destructive action left; Cancel then confirmation right, in visual and tab order. */
export const actionGroup = <M>(config: ActionGroupConfig<M>, h: HtmlBuilder<M>) => {
  const action = (value: Action<M>, variant: "destructive" | "secondary" | "default") =>
    button(
      {
        variant,
        size: "lg",
        onClick: value.onClick,
        isDisabled: value.isDisabled,
        attributes: [h.AriaLabel(value.ariaLabel ?? value.label)],
      },
      value.label,
      h,
    );
  return h.div(
    [
      h.Class("flex w-full flex-wrap items-center justify-between gap-3"),
      h.DataAttribute("slot", "action-group"),
    ],
    [
      ...(config.destructive ? [action(config.destructive, "destructive")] : []),
      h.div(
        [h.Class("ml-auto flex flex-wrap items-center justify-end gap-2")],
        [
          ...(config.cancel ? [action(config.cancel, "secondary")] : []),
          ...(config.confirm ? [action(config.confirm, "default")] : []),
        ],
      ),
    ],
  );
};
