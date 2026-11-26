import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

/** Upstream keys label disabling on a native peer-disabled sibling variant
 *  and `group-data-[disabled=true]`, neither of which matches in Optio's markup
 *  (no `.peer` sibling; `data-disabled` is emitted empty). Re-keyed onto a
 *  live `group` ancestor carrying data-disabled — e.g. the fieldset compound
 *  or switch wrapper. */
export const labelClass =
  "gap-2 text-sm leading-none font-medium group-data-[disabled]:opacity-50 flex items-center select-none group-data-[disabled]/field-set:pointer-events-none group-data-[disabled]/field-set:cursor-not-allowed group-data-[disabled]/field-set:opacity-50";

type LabelConfig = Readonly<{ forId?: string; className?: string }>;

/** Styled label. Mirrors the shadcn v4 `label.tsx` (no Radix primitive). */
export const label = <M>(config: LabelConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.label
    .class(cn(labelClass, config.className))
    .attr("data-slot", "label")
    .attr("for", config.forId)
    .children(children);
