import { Match } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { cardClass } from "@/components/ui/card";
import { itemSizes } from "@/components/ui/item";
import { skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { page } from "./layout";

/** Placeholder rows shaped like a grouped list, so content replaces it in place. */
export type SkeletonBlock =
  | Readonly<{ _tag: "List"; rows: number; subtitles?: boolean }>
  /** Labeled form controls on a plain surface, such as the session launcher. */
  | Readonly<{ _tag: "Controls"; rows: number }>
  /** A full-width large button (`h-12`). */
  | Readonly<{ _tag: "Action" }>;

const bar = <M>(className: string, h: HtmlBuilder<M>) => skeleton({ className }, [], h);

// Varied widths read as text rather than a grid of identical bars.
const titleWidths = ["w-2/5", "w-1/2", "w-1/3", "w-3/5"];
const subtitleWidths = ["w-1/4", "w-1/3", "w-1/5", "w-2/5"];

const sectionHeader = <M>(h: HtmlBuilder<M>) => bar("mb-2 h-4 w-24", h);

const listRow = <M>(index: number, subtitles: boolean, h: HtmlBuilder<M>) =>
  h.div(
    [h.Class(cn(itemSizes.default, "flex min-h-11 flex-col justify-center"))],
    [
      bar(cn("h-4", titleWidths[index % titleWidths.length]), h),
      ...(subtitles
        ? [bar(cn("mt-1.5 h-3", subtitleWidths[index % subtitleWidths.length]), h)]
        : []),
    ],
  );

const controlRow = <M>(h: HtmlBuilder<M>) =>
  h.div([h.Class("flex flex-col gap-2")], [bar("h-4 w-28", h), bar("h-11 w-full", h)]);

const indexesOf = (rows: number) => Array.from({ length: rows }, (_, index) => index);

const block = <M>(config: SkeletonBlock, h: HtmlBuilder<M>): Html =>
  Match.valueTags(config, {
    List: ({ rows, subtitles }) =>
      h.div(
        [h.Class("flex flex-col")],
        [
          sectionHeader(h),
          h.div(
            [h.Class(cn(cardClass, "gap-0 py-0 divide-y divide-border"))],
            indexesOf(rows).map((index) => listRow(index, subtitles ?? false, h)),
          ),
        ],
      ),
    Controls: ({ rows }) =>
      h.div(
        [h.Class("flex flex-col gap-4")],
        [sectionHeader(h), ...indexesOf(rows).map(() => controlRow(h))],
      ),
    Action: () => bar("h-12 w-full", h),
  });

/**
 * A page-shaped placeholder for saved data that has not been read yet. It is
 * revealed only after a short delay (`loading-reveal`), so quick reads go
 * straight to content; slow ones show the page's outline instead of a blank
 * screen. Screen readers hear one status message, not the decorative blocks.
 */
export const skeletonPage = <M>(
  config: Readonly<{ label: string; blocks: ReadonlyArray<SkeletonBlock> }>,
  h: HtmlBuilder<M>,
): Html =>
  page(
    { className: "loading-reveal" },
    [
      h.p([h.Class("sr-only"), h.Role("status")], [config.label]),
      ...config.blocks.map((item) =>
        h.div([h.AriaHidden(true), h.DataAttribute("slot", "skeleton-block")], [block(item, h)]),
      ),
    ],
    h,
  );
