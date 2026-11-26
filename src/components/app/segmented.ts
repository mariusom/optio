import type { H, Ui } from "@/lib/view";
import { Array } from "effect";

import { sectionFooter, sectionHeader } from "./layout";

type Child = Ui | string;

export type Segment<M> = Readonly<{ label: string; selected: boolean; onSelect: M }>;

/**
 * Compact single choice between a few short options (iOS segmented control).
 * Native radio inputs supply the semantics: one tab stop on the checked
 * option, arrow keys move and select, and the group is named by its header.
 * Each input covers its whole 44px segment, so taps and tests hit the input.
 * Labels wrap rather than truncate, so larger text never hides a choice.
 */
export const segmentedControl = <M>(
  config: Readonly<{
    /** Radio group name; unique on the page (responsive copies need their own). */
    name: string;
    label: string;
    footer?: Child;
    segments: ReadonlyArray<Segment<M>>;
  }>,
  h: H<M>,
): Ui =>
  h.section.class("flex flex-col").children(
    sectionHeader(config.label, h),
    h.div
      .attr("role", "radiogroup")
      .attr("aria-label", config.label)
      .attr("data-slot", "segmented-control")
      .class("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1")
      .children(
        Array.map(config.segments, (segment) =>
          h.label
            .class(
              "relative flex min-h-11 min-w-0 items-center justify-center rounded-md px-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-background/60 has-[:checked]:bg-background has-[:checked]:font-semibold has-[:checked]:text-foreground has-[:checked]:shadow-sm has-[:checked]:ring-1 has-[:checked]:ring-input has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
            )
            .children(
              h.input
                .class("absolute inset-0 size-full cursor-pointer rounded-md opacity-0")
                .attr("type", "radio")
                .attr("name", config.name)
                .value(segment.label)
                .checked(segment.selected)
                .on("change", () => segment.onSelect),
              h.span
                .class("pointer-events-none py-1 leading-tight [overflow-wrap:anywhere]")
                .children(segment.label),
            ),
        ),
      ),
    config.footer === undefined ? [] : [sectionFooter(config.footer, h)],
  );
