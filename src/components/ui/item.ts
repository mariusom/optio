import type { H, Ui } from "@/lib/view";
import { cn } from "@/lib/utils";

type Child = Ui | string;

export const itemGroupClass =
  "gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2 group/item-group flex w-full flex-col";

export const itemSeparatorClass = "my-2";

export const itemVariantKeys = ["default", "outline", "muted"] as const;
export type ItemVariant = (typeof itemVariantKeys)[number];

export const itemVariants: Record<ItemVariant, string> = {
  default: "border-transparent",
  outline: "border-border",
  muted: "bg-muted/50 border-transparent",
};

export const itemSizeKeys = ["default", "sm", "xs"] as const;
export type ItemSize = (typeof itemSizeKeys)[number];

export const itemSizes: Record<ItemSize, string> = {
  default: "gap-2.5 px-3 py-2.5",
  sm: "gap-2.5 px-3 py-2.5",
  xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
};

/** Upstream cva base string. */
export const itemClass =
  "[a]:hover:bg-muted rounded-lg border text-sm group/item flex w-full flex-wrap items-center transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors";

export const itemMediaVariantKeys = ["default", "icon", "image"] as const;
export type ItemMediaVariant = (typeof itemMediaVariantKeys)[number];

export const itemMediaVariants: Record<ItemMediaVariant, string> = {
  default: "bg-transparent",
  icon: "[&_svg:not([class*='size-'])]:size-4",
  image:
    "size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
};

export const itemMediaClass =
  "gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start flex shrink-0 items-center justify-center [&_svg]:pointer-events-none";

export const itemContentClass =
  "gap-1 group-data-[size=xs]/item:gap-0 flex flex-1 flex-col [&+[data-slot=item-content]]:flex-none";

export const itemTitleClass =
  "gap-2 text-sm leading-snug font-medium underline-offset-4 line-clamp-1 flex w-fit items-center";

export const itemDescriptionClass =
  "text-muted-foreground text-left text-sm leading-normal group-data-[size=xs]/item:text-xs line-clamp-2 font-normal [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary";

export const itemActionsClass = "gap-2 flex items-center";
export const itemHeaderClass = "gap-2 flex basis-full items-center justify-between";
export const itemFooterClass = "gap-2 flex basis-full items-center justify-between";

type StyleConfig = Readonly<{ className?: string }>;

type ItemConfig = Readonly<{
  variant?: ItemVariant;
  size?: ItemSize;
  className?: string;
}>;

type ItemMediaConfig = Readonly<{ variant?: ItemMediaVariant; className?: string }>;

type ItemSeparatorConfig = Readonly<{
  orientation?: "horizontal" | "vertical";
  className?: string;
}>;

const itemGroup = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .attr("role", "list")
    .class(cn(itemGroupClass, config.className))
    .attr("data-slot", "item-group")
    .children(children);

const itemSeparator = <M>(config: ItemSeparatorConfig, h: H<M>): Ui =>
  h.div
    .class(cn(itemSeparatorClass, config.className))
    .attr("role", "separator")
    .attr("aria-orientation", config.orientation ?? "horizontal")
    .attr("data-slot", "item-separator")
    .attr("data-orientation", config.orientation ?? "horizontal")
    .attr(`data-${config.orientation ?? "horizontal"}`, "");

const itemContainer = <M>(config: ItemConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(
      cn(
        itemClass,
        itemVariants[config.variant ?? "default"],
        itemSizes[config.size ?? "default"],
        config.className,
      ),
    )
    .attr("data-slot", "item")
    .attr("data-variant", config.variant ?? "default")
    .attr("data-size", config.size ?? "default")
    .children(children);

const itemMedia = <M>(config: ItemMediaConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(itemMediaClass, itemMediaVariants[config.variant ?? "default"], config.className))
    .attr("data-slot", "item-media")
    .attr("data-variant", config.variant ?? "default")
    .children(children);

const itemContent = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(itemContentClass, config.className))
    .attr("data-slot", "item-content")
    .children(children);

const itemTitle = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(itemTitleClass, config.className))
    .attr("data-slot", "item-title")
    .children(children);

const itemDescription = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.p
    .class(cn(itemDescriptionClass, config.className))
    .attr("data-slot", "item-description")
    .children(children);

const itemActions = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(itemActionsClass, config.className))
    .attr("data-slot", "item-actions")
    .children(children);

const itemHeader = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(itemHeaderClass, config.className))
    .attr("data-slot", "item-header")
    .children(children);

const itemFooter = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(itemFooterClass, config.className))
    .attr("data-slot", "item-footer")
    .children(children);

/** Styled item — a flexible list row with `Item.group`, `Item.separator`,
 *  `Item.media`, `Item.content`, `Item.title`, `Item.description`,
 *  `Item.actions`, `Item.header`, `Item.footer` sub-builders. Mirrors the
 *  shadcn v4 `item.tsx`. */
export const Item = Object.assign(itemContainer, {
  group: itemGroup,
  separator: itemSeparator,
  media: itemMedia,
  content: itemContent,
  title: itemTitle,
  description: itemDescription,
  actions: itemActions,
  header: itemHeader,
  footer: itemFooter,
});
