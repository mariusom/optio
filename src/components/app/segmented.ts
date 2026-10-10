import type { Html, HtmlBuilder } from "foldkit/html";

import { sectionFooter, sectionHeader } from "./layout";

type Child = Html | string;

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
  h: HtmlBuilder<M>,
): Html =>
  h.section(
    [h.Class("flex flex-col")],
    [
      sectionHeader(config.label, h),
      h.div(
        [
          h.Role("radiogroup"),
          h.AriaLabel(config.label),
          h.DataAttribute("slot", "segmented-control"),
          h.Class("grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1"),
        ],
        config.segments.map((segment) =>
          h.label(
            [
              h.Class(
                "relative flex min-h-11 min-w-0 items-center justify-center rounded-md px-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-background/60 has-[:checked]:bg-background has-[:checked]:font-semibold has-[:checked]:text-foreground has-[:checked]:shadow-sm has-[:checked]:ring-1 has-[:checked]:ring-input has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              ),
            ],
            [
              h.input([
                h.Class("absolute inset-0 size-full cursor-pointer rounded-md opacity-0"),
                h.Type("radio"),
                h.Name(config.name),
                h.Value(segment.label),
                h.Checked(segment.selected),
                h.OnChange(() => segment.onSelect),
              ]),
              h.span(
                [h.Class("pointer-events-none py-1 leading-tight [overflow-wrap:anywhere]")],
                [segment.label],
              ),
            ],
          ),
        ),
      ),
      ...(config.footer === undefined ? [] : [sectionFooter(config.footer, h)]),
    ],
  );
