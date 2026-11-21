import { Progress } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { cn } from "@/lib/utils";

type Child = Html | string;

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

/** FoldKit owns range and accessibility; the wrapper owns Foldcn styling. */
export const progress = <M>(config: ProgressConfig, h: HtmlBuilder<M>): Html =>
  Progress.view(
    {
      ...config,
      toView: ({ progress: root, track, indicator }) =>
        h.div(
          [
            ...root,
            h.Class(cn(progressClass, config.className)),
            h.DataAttribute("slot", "progress"),
          ],
          [
            ...(config.children ?? []),
            h.div(
              [
                ...track,
                h.Class(cn(progressTrackClass)),
                h.DataAttribute("slot", "progress-track"),
                ...(config.segments === undefined
                  ? []
                  : [
                      h.Style({
                        maskImage: `repeating-linear-gradient(to right, black 0 calc(100% / ${config.segments} - 3px), transparent 0 calc(100% / ${config.segments}))`,
                      }),
                    ]),
              ],
              [
                h.div([
                  ...indicator,
                  h.Class(cn(progressIndicatorClass)),
                  h.DataAttribute("slot", "progress-indicator"),
                ]),
              ],
            ),
          ],
        ),
    },
    h,
  );

/** Static label for the bar (consumer-owned text). */
export const progressLabel = <M>(
  config: StyleConfig & Readonly<{ id?: string }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(progressLabelClass, config.className)),
      h.DataAttribute("slot", "progress-label"),
      ...(config.id === undefined ? [] : [h.Id(config.id)]),
    ],
    children,
  );

/** Static value readout (consumer-owned text, e.g. "3 of 5"). */
export const progressValue = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [h.Class(cn(progressValueClass, config.className)), h.DataAttribute("slot", "progress-value")],
    children,
  );
