import type { Html, HtmlBuilder } from "foldkit/html";

type Child = Html | string;

import { cn } from "@/lib/utils";

export const skeletonClass = "bg-muted rounded-md animate-pulse";

type StyleConfig = Readonly<{ className?: string }>;

/** Styled skeleton placeholder — a pulsing block. Mirrors the shadcn v4
 *  `skeleton.tsx`. */
export const skeleton = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(skeletonClass, config.className)), h.DataAttribute("slot", "skeleton")],
    children,
  );
