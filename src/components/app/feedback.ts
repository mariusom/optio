import type { Html, HtmlBuilder } from "foldkit/html";
import type { IconNode } from "lucide";

import { Empty } from "@/components/ui/empty";
import { Alert } from "@/components/ui/alert";
import { button } from "@/components/ui/button";
import { spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { CircleAlert, Info, TriangleAlert, X, icon } from "./icons";

type Child = Html | string;

/** Centered empty state: icon, one-line title, short reason, one action. */
export const emptyState = <M>(
  config: Readonly<{
    icon: IconNode;
    title: string;
    description?: Child;
    action?: Html;
    className?: string;
  }>,
  h: HtmlBuilder<M>,
): Html =>
  Empty(
    { className: config.className },
    [
      Empty.header(
        {},
        [
          Empty.media({ variant: "icon" }, [icon(h, config.icon, "")], h),
          Empty.title({}, [config.title], h),
          ...(config.description === undefined
            ? []
            : [Empty.description({}, [config.description], h)]),
        ],
        h,
      ),
      ...(config.action === undefined ? [] : [Empty.content({}, [config.action], h)]),
    ],
    h,
  );

export type NoticeTone = "info" | "warning" | "error";

const noticeTones: Record<NoticeTone, { classes: string; icon: IconNode }> = {
  info: { classes: "border-primary/15 bg-primary/8 text-foreground", icon: Info },
  warning: { classes: "border-warning/30 bg-warning/20 text-warning-content", icon: TriangleAlert },
  error: { classes: "border-destructive/20 bg-destructive/10 text-destructive", icon: CircleAlert },
};

/** Inline notice (iOS-style callout). Use for state the user can act on. */
export const notice = <M>(
  config: Readonly<{
    tone?: NoticeTone;
    text: Child;
    onDismiss?: M;
    dismissLabel?: string;
    className?: string;
    role?: "alert" | "status";
  }>,
  h: HtmlBuilder<M>,
): Html => {
  const tone = noticeTones[config.tone ?? "info"];
  return Alert(
    {
      className: cn(
        "p-4 leading-snug has-data-[slot=alert-action]:min-h-16",
        tone.classes,
        config.className,
      ),
      role: config.role ?? (config.tone === "error" ? "alert" : "status"),
    },
    [
      icon(h, tone.icon, "mt-0.5 size-4 shrink-0"),
      Alert.description({ className: "min-w-0 text-current" }, [config.text], h),
      ...(config.onDismiss === undefined
        ? []
        : [
            Alert.action(
              {},
              [
                button(
                  {
                    type: "button",
                    variant: "ghost",
                    size: "icon",
                    className: "shrink-0",
                    onClick: config.onDismiss,
                    attributes: [h.AriaLabel(config.dismissLabel ?? "Dismiss")],
                  },
                  icon(h, X, ""),
                  h,
                ),
              ],
              h,
            ),
          ]),
    ],
    h,
  );
};

/** Short helper text under a disabled primary action ("Answer the 2 starred questions first"). */
export const hint = <M>(text: Child, h: HtmlBuilder<M>, className?: string): Html =>
  h.p(
    [h.Class(cn("text-center text-sm text-muted-foreground", className)), h.Role("status")],
    [text],
  );

/**
 * Saved data that has not been read yet. It appears only after a short delay
 * (`loading-reveal`), so a fast read goes straight from blank to content
 * instead of flashing a spinner or an empty state.
 */
export const loadingState = <M>(text: string, h: HtmlBuilder<M>): Html =>
  h.div(
    [h.Class("loading-reveal flex h-full min-h-40 items-center justify-center p-8")],
    [
      h.p(
        [h.Class("flex items-center gap-2 text-sm text-muted-foreground"), h.Role("status")],
        [spinner({}, h), text],
      ),
    ],
  );
