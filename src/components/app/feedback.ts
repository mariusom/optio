import type { Html, HtmlBuilder } from "foldkit/html";
import type { IconNode } from "lucide";

import { Empty } from "@/components/ui/empty";
import { button } from "@/components/ui/button";
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
  return h.div(
    [
      h.Class(
        cn(
          "flex items-start gap-3 rounded-lg border p-4 text-sm leading-snug",
          tone.classes,
          config.className,
        ),
      ),
      h.Role(config.role ?? (config.tone === "error" ? "alert" : "status")),
    ],
    [
      icon(h, tone.icon, "mt-0.5 size-4 shrink-0"),
      h.p([h.Class("min-w-0 flex-1")], [config.text]),
      ...(config.onDismiss === undefined
        ? []
        : [
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
          ]),
    ],
  );
};

/** Short helper text under a disabled primary action ("Answer the 2 starred questions first"). */
export const hint = <M>(text: Child, h: HtmlBuilder<M>, className?: string): Html =>
  h.p(
    [h.Class(cn("text-center text-sm text-muted-foreground", className)), h.Role("status")],
    [text],
  );
