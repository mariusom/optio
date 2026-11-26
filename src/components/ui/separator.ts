// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { Separator } from "@effect/ui-kit";
import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";

export type SeparatorOrientation = "horizontal" | "vertical";

export const separatorClass =
  "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch";

type SeparatorConfig = Readonly<{
  orientation?: SeparatorOrientation;
  className?: string;
}>;

/** Styled separator on the @effect/ui-kit Separator view function (role,
 *  aria-orientation, data-orientation); `data-horizontal`/`data-vertical`
 *  key the Foldcn classes. */
export const separator = <M>(config: SeparatorConfig, h: H<M>): Ui => {
  const orientation = config.orientation ?? "horizontal";
  return Separator(h, { props: { orientation } })
    .class(cn(separatorClass, config.className))
    .attr("data-slot", "separator")
    .attr(`data-${orientation}`, "");
};
