import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

export const skeletonClass = "bg-muted rounded-md animate-pulse";

type StyleConfig = Readonly<{ className?: string }>;

/** Styled skeleton placeholder — a pulsing block. Mirrors the shadcn v4
 *  `skeleton.tsx`. */
export const skeleton = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div.class(cn(skeletonClass, config.className)).attr("data-slot", "skeleton").children(children);
