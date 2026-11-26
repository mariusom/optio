import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

export const progressClass = "flex flex-wrap gap-3";

export const progressTrackClass =
  "bg-muted h-1 rounded-full relative flex w-full items-center overflow-x-hidden";

export const progressIndicatorClass = "bg-primary h-full transition-all";

export const progressLabelClass = "text-sm font-medium";

export const progressValueClass = "text-muted-foreground ml-auto text-sm tabular-nums";

type StyleConfig = Readonly<{ className?: string }>;

type ProgressConfig = Readonly<{
  id: string;
  value: number;
  ariaLabel: string;
  valueText?: string;
  className?: string;
  segments?: number;
  children?: ReadonlyArray<Child>;
}>;

/** Native `role="progressbar"` markup over a 0–100 range (the kit's Progress
 *  is a headless Component instance); the wrapper owns Foldcn styling. */
export const progress = <M>(config: ProgressConfig, h: H<M>): Ui => {
  const value = Math.min(100, Math.max(0, config.value));
  const state = value >= 100 ? "complete" : "loading";
  const dataAttributes = {
    "data-value": String(value),
    "data-min": "0",
    "data-max": "100",
    "data-state": state,
  };
  return h.div
    .id(config.id)
    .attrs({
      role: "progressbar",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": String(value),
      "aria-valuetext": config.valueText,
      "aria-label": config.ariaLabel,
      ...dataAttributes,
      "data-slot": "progress",
    })
    .class(cn(progressClass, config.className))
    .children(
      config.children ?? [],
      h.div
        .attr("data-state", state)
        .attr("data-slot", "progress-track")
        .class(cn(progressTrackClass))
        .style(
          config.segments === undefined
            ? {}
            : {
                maskImage: `repeating-linear-gradient(to right, black 0 calc(100% / ${config.segments} - 3px), transparent 0 calc(100% / ${config.segments}))`,
              },
        )
        .children(
          h.div
            .attrs({ ...dataAttributes, "data-slot": "progress-indicator" })
            .class(cn(progressIndicatorClass))
            .style({ width: `${value}%` }),
        ),
    );
};

/** Static label for the bar (consumer-owned text). */
export const progressLabel = <M>(
  config: StyleConfig & Readonly<{ id?: string }>,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  h.span
    .class(cn(progressLabelClass, config.className))
    .attr("data-slot", "progress-label")
    .attr("id", config.id)
    .children(children);

/** Static value readout (consumer-owned text, e.g. "3 of 5"). */
export const progressValue = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: H<M>,
): Ui =>
  h.span
    .class(cn(progressValueClass, config.className))
    .attr("data-slot", "progress-value")
    .children(children);
