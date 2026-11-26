import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

export const alertVariantKeys = ["default", "destructive"] as const;
export type AlertVariant = (typeof alertVariantKeys)[number];

export const alertVariants: Record<AlertVariant, string> = {
  default: "bg-card text-card-foreground",
  destructive:
    "text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
};

export const alertClass =
  "grid gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 group/alert relative w-full";

export const alertTitleClass =
  "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground";

export const alertDescriptionClass =
  "text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground";

export const alertActionClass = "absolute top-2 right-2";

type StyleConfig = Readonly<{
  className?: string;
  variant?: AlertVariant;
  role?: "alert" | "status";
}>;

const alertContainer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(alertClass, alertVariants[config.variant ?? "default"], config.className))
    .attr("role", config.role ?? "alert")
    .attr("data-slot", "alert")
    .attr("data-variant", config.variant ?? "default")
    .children(children);

const alertTitle = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(alertTitleClass, config.className))
    .attr("data-slot", "alert-title")
    .children(children);

const alertDescription = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(alertDescriptionClass, config.className))
    .attr("data-slot", "alert-description")
    .children(children);

/** Alert action — an absolutely positioned slot in the top-right corner; the
 *  container token reserves room for it via has-data-[slot=alert-action]. */
const alertAction = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(alertActionClass, config.className))
    .attr("data-slot", "alert-action")
    .children(children);

/**
 * Styled alert — `Alert.title`, `Alert.description` and `Alert.action`
 *  sub-builders.
 */
export const Alert = Object.assign(alertContainer, {
  title: alertTitle,
  description: alertDescription,
  action: alertAction,
});
