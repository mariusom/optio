import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";

type Child = Ui | string;

export const kbdClass =
  "bg-muted text-muted-foreground in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 h-5 w-fit min-w-5 gap-1 rounded-sm px-1 font-sans text-xs font-medium [&_svg:not([class*='size-'])]:size-3 pointer-events-none inline-flex items-center justify-center select-none";

export const kbdGroupClass = "gap-1 inline-flex items-center";

type StyleConfig = Readonly<{ className?: string }>;

const kbdContainer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.kbd.class(cn(kbdClass, config.className)).attr("data-slot", "kbd").children(children);

const kbdGroup = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.kbd
    .class(cn(kbdGroupClass, config.className))
    .attr("data-slot", "kbd-group")
    .children(children);

/** Styled keyboard key(s). `Kbd.group` clusters several keys. Mirrors the
 *  shadcn v4 `kbd.tsx`. */
export const Kbd = Object.assign(kbdContainer, { group: kbdGroup });
