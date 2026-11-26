import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

export const emptyClass =
  "gap-4 rounded-xl border-dashed p-6 flex w-full min-w-0 flex-1 flex-col items-center justify-center text-center text-balance";

export const emptyHeaderClass = "gap-2 flex max-w-sm flex-col items-center";

export const emptyMediaVariantKeys = ["default", "icon"] as const;
export type EmptyMediaVariant = (typeof emptyMediaVariantKeys)[number];

export const emptyMediaClass =
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const emptyMediaVariants: Record<EmptyMediaVariant, string> = {
  default: "bg-transparent",
  icon: "bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-4",
};

export const emptyTitleClass = "text-sm font-medium tracking-tight font-heading";

export const emptyDescriptionClass =
  "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary";

export const emptyContentClass =
  "gap-2.5 text-sm flex w-full max-w-sm min-w-0 flex-col items-center text-balance";

type StyleConfig = Readonly<{ className?: string }>;

type EmptyMediaConfig = Readonly<{ variant?: EmptyMediaVariant; className?: string }>;

const emptyContainer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div.class(cn(emptyClass, config.className)).attr("data-slot", "empty").children(children);

const emptyHeader = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(emptyHeaderClass, config.className))
    .attr("data-slot", "empty-header")
    .children(children);

const emptyMedia = <M>(config: EmptyMediaConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(emptyMediaClass, emptyMediaVariants[config.variant ?? "default"], config.className))
    .attr("data-slot", "empty-icon")
    .attr("data-variant", config.variant ?? "default")
    .children(children);

const emptyTitle = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(emptyTitleClass, config.className))
    .attr("data-slot", "empty-title")
    .children(children);

const emptyDescription = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(emptyDescriptionClass, config.className))
    .attr("data-slot", "empty-description")
    .children(children);

const emptyContent = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(emptyContentClass, config.className))
    .attr("data-slot", "empty-content")
    .children(children);

/** Styled empty state — `Empty.header`, `Empty.media`, `Empty.title`,
 *  `Empty.description`, `Empty.content` sub-builders. Mirrors the shadcn v4
 *  `empty.tsx`. */
export const Empty = Object.assign(emptyContainer, {
  header: emptyHeader,
  media: emptyMedia,
  title: emptyTitle,
  description: emptyDescription,
  content: emptyContent,
});
