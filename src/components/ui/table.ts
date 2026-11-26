import type { H, Ui } from "@/lib/view";

import { cn } from "@/lib/utils";

type Child = Ui | string;

// Table is a pure presentational primitive. `Table` is the container
// (`table`); sub-builders are attached as properties: Table.header, Table.body,
// Table.footer, Table.row, Table.head, Table.cell, Table.caption.

export const tableContainerClass = "relative w-full overflow-x-auto";

export const tableClass = "w-full caption-bottom text-sm";

export const tableHeaderClass = "[&_tr]:border-b";

export const tableBodyClass = "[&_tr:last-child]:border-0";

export const tableFooterClass = "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0";

export const tableRowClass =
  "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors has-aria-expanded:bg-muted/50";

export const tableHeadClass =
  "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0";

export const tableCellClass = "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0";

export const tableCaptionClass = "text-muted-foreground mt-4 text-sm";

type StyleConfig = Readonly<{ className?: string }>;

const tableContainer = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.div
    .class(cn(tableContainerClass))
    .attr("data-slot", "table-container")
    .children(
      h.table.class(cn(tableClass, config.className)).attr("data-slot", "table").children(children),
    );

const tableHeader = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.thead
    .class(cn(tableHeaderClass, config.className))
    .attr("data-slot", "table-header")
    .children(children);

const tableBody = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.tbody
    .class(cn(tableBodyClass, config.className))
    .attr("data-slot", "table-body")
    .children(children);

const tableFooter = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.tfoot
    .class(cn(tableFooterClass, config.className))
    .attr("data-slot", "table-footer")
    .children(children);

const tableRow = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.tr.class(cn(tableRowClass, config.className)).attr("data-slot", "table-row").children(children);

const tableHead = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.th
    .class(cn(tableHeadClass, config.className))
    .attr("data-slot", "table-head")
    .children(children);

const tableCell = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.td
    .class(cn(tableCellClass, config.className))
    .attr("data-slot", "table-cell")
    .children(children);

const tableCaption = <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: H<M>): Ui =>
  h.caption
    .class(cn(tableCaptionClass, config.className))
    .attr("data-slot", "table-caption")
    .children(children);

/** Composable table — `Table` is the container, with sub-builders as
 *  properties: `Table.header`, `Table.body`, `Table.footer`, `Table.row`,
 *  `Table.head`, `Table.cell`, `Table.caption`. */
export const Table = Object.assign(tableContainer, {
  header: tableHeader,
  body: tableBody,
  footer: tableFooter,
  row: tableRow,
  head: tableHead,
  cell: tableCell,
  caption: tableCaption,
});
