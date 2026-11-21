import type { Html, HtmlBuilder } from "foldkit/html";

import { cn } from "@/lib/utils";

type Child = Html | string;

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

const tableContainer = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(tableContainerClass)), h.DataAttribute("slot", "table-container")],
    [
      h.table(
        [h.Class(cn(tableClass, config.className)), h.DataAttribute("slot", "table")],
        children,
      ),
    ],
  );

const tableHeader = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.thead(
    [h.Class(cn(tableHeaderClass, config.className)), h.DataAttribute("slot", "table-header")],
    children,
  );

const tableBody = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.tbody(
    [h.Class(cn(tableBodyClass, config.className)), h.DataAttribute("slot", "table-body")],
    children,
  );

const tableFooter = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.tfoot(
    [h.Class(cn(tableFooterClass, config.className)), h.DataAttribute("slot", "table-footer")],
    children,
  );

const tableRow = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.tr(
    [h.Class(cn(tableRowClass, config.className)), h.DataAttribute("slot", "table-row")],
    children,
  );

const tableHead = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.th(
    [h.Class(cn(tableHeadClass, config.className)), h.DataAttribute("slot", "table-head")],
    children,
  );

const tableCell = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.td(
    [h.Class(cn(tableCellClass, config.className)), h.DataAttribute("slot", "table-cell")],
    children,
  );

const tableCaption = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.caption(
    [h.Class(cn(tableCaptionClass, config.className)), h.DataAttribute("slot", "table-caption")],
    children,
  );

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
