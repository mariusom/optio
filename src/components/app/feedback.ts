import type { Html, HtmlBuilder } from "foldkit/html";
import type { IconNode } from "lucide";

import { Empty } from "@/components/ui/empty";
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
    { className: cn("py-16 md:py-24", config.className) },
    [
      Empty.header(
        {},
        [
          Empty.media(
            {
              variant: "icon",
              className: "size-14 rounded-2xl bg-primary/10 text-primary [&_svg]:size-7",
            },
            [icon(h, config.icon, "size-7")],
            h,
          ),
          Empty.title({ className: "text-lg font-semibold tracking-tight" }, [config.title], h),
          ...(config.description === undefined
            ? []
            : [Empty.description({ className: "text-[0.9375rem]" }, [config.description], h)]),
        ],
        h,
      ),
      ...(config.action === undefined
        ? []
        : [Empty.content({ className: "mt-2" }, [config.action], h)]),
    ],
    h,
  );

export type NoticeTone = "info" | "warning" | "error";

const noticeTones: Record<NoticeTone, { classes: string; icon: IconNode }> = {
  info: { classes: "bg-primary/8 text-foreground ring-primary/15", icon: Info },
  warning: { classes: "bg-warning/20 text-warning-content ring-warning/30", icon: TriangleAlert },
  error: { classes: "bg-destructive/10 text-destructive ring-destructive/20", icon: CircleAlert },
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
          "flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug ring-1",
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
            h.button(
              [
                h.Type("button"),
                h.Class(
                  "-m-3 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-foreground/5",
                ),
                h.AriaLabel(config.dismissLabel ?? "Dismiss"),
                h.OnClick(config.onDismiss),
              ],
              [icon(h, X, "size-4")],
            ),
          ]),
    ],
  );
};

/** Short helper text under a disabled primary action ("Answer the 2 starred questions first"). */
export const hint = <M>(text: Child, h: HtmlBuilder<M>, className?: string): Html =>
  h.p(
    [
      h.Class(cn("text-center text-[0.8125rem] text-muted-foreground", className)),
      h.Role("status"),
    ],
    [text],
  );
