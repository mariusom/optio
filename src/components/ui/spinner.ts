import type { Html, HtmlBuilder } from "foldkit/html";
import { Loader2 } from "lucide";
import { icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export const spinnerClass = "size-4 animate-spin";

/** Foldcn spinner using the selected icon library. The parent owns the live status. */
export const spinner = <M>(config: Readonly<{ className?: string }>, h: HtmlBuilder<M>): Html =>
  h.span(
    [h.DataAttribute("slot", "spinner"), h.AriaHidden(true)],
    [icon(h, Loader2, cn(spinnerClass, "motion-reduce:animate-none", config.className))],
  );
