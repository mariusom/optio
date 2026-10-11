import type { Attribute, Html, HtmlBuilder } from "foldkit/html";
import { cn } from "@/lib/utils";

type Child = Html | string;

/**
 * foldkit gap: upstream drives the indicator transform and the value text
 * from the Base UI Progress primitive. Here `value` (0–100) positions the
 * indicator directly; `undefined` renders an EMPTY track — animated
 * indeterminate needs primitive support. The label/value builders render
 * static content the consumer owns.
 *
 * Local customization: `children` (label/value) render before the track, as
 * in upstream's anatomy, and `attributes` let the consumer name the bar
 * (`aria-label`, `aria-valuetext`); a progressbar needs an accessible name.
 */

export const progressClass = "flex flex-wrap gap-3";

export const progressTrackClass =
  "bg-muted h-1 rounded-full relative flex w-full items-center overflow-x-hidden";

export const progressIndicatorClass = "bg-primary h-full transition-all";

export const progressLabelClass = "text-sm font-medium";

export const progressValueClass = "text-muted-foreground ml-auto text-sm tabular-nums";

type StyleConfig = Readonly<{ className?: string }>;

type ProgressConfig<M> = Readonly<{
  value?: number;
  className?: string;
  children?: ReadonlyArray<Child>;
  attributes?: ReadonlyArray<Attribute<M>>;
}>;

const clampValue = (value: number): number => Math.min(100, Math.max(0, value));

const progressIndicator = <M>(value: number | undefined, h: HtmlBuilder<M>): Html =>
  h.div([
    h.Class(cn(progressIndicatorClass)),
    h.DataAttribute("slot", "progress-indicator"),
    // Undefined = indeterminate: empty track until primitives can animate.
    h.Style({
      transform: `translateX(-${100 - (value === undefined ? 0 : clampValue(value))}%)`,
    }),
  ]);

/** Styled progress bar with an accessible track. */
export const progress = <M>(config: ProgressConfig<M>, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Class(cn(progressClass, config.className)),
      h.Role("progressbar"),
      h.AriaValuemin(0),
      h.AriaValuemax(100),
      ...(config.value === undefined ? [] : [h.AriaValuenow(clampValue(config.value))]),
      h.DataAttribute("slot", "progress"),
      ...(config.attributes ?? []),
    ],
    [
      ...(config.children ?? []),
      h.div(
        [h.Class(cn(progressTrackClass)), h.DataAttribute("slot", "progress-track")],
        [progressIndicator(config.value, h)],
      ),
    ],
  );

/** Static label for the bar (consumer-owned text). */
export const progressLabel = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [h.Class(cn(progressLabelClass, config.className)), h.DataAttribute("slot", "progress-label")],
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

export const Progress = Object.assign(progress, {
  track: <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: HtmlBuilder<M>): Html =>
    h.div(
      [
        h.Class(cn(progressTrackClass, config.className)),
        h.DataAttribute("slot", "progress-track"),
      ],
      children,
    ),
  indicator: progressIndicator,
  label: progressLabel,
  value: progressValue,
});
