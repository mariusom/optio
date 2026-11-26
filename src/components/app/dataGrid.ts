import {
  columnFilteringFeature,
  constructTable,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  type ColumnDef,
  type Header,
  type RowData,
  type SortingState,
} from "@tanstack/table-core";
import { storeReactivityBindings } from "@tanstack/table-core/store-reactivity-bindings";
import { Array, Record } from "effect";
import type { H, Ui } from "@/lib/view";

import { inputClass } from "@/components/ui/input";
import { nativeSelectClass } from "@/components/ui/native-select";
import { Table } from "@/components/ui/table";
import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ChevronDown, Ellipsis, Search, icon } from "./icons";

type Child = Ui | string;

/** Saved grid state: the search text, sort order and one value per column filter. */
export type GridState = Readonly<{
  query: string;
  sorting: ReadonlyArray<Readonly<{ id: string; desc: boolean }>>;
  filters: Readonly<Record<string, string>>;
}>;

export type GridColumn<Row> = Readonly<{
  id: string;
  header: string;
  /** Sorted, searched and filtered value. */
  value: (row: Row) => string | number;
  cell: (row: Row) => Child;
  align?: "start" | "end";
  /** Below this width the column is hidden; its data should appear elsewhere in the row. */
  from?: "sm" | "md" | "lg";
  /** First sort is descending (dates, durations, counts). */
  descFirst?: boolean;
  searchable?: boolean;
  className?: string;
}>;

export type GridFilter = Readonly<{
  columnId: string;
  label: string;
  /** Option shown for "no filter", such as "All templates". */
  allLabel: string;
  options: ReadonlyArray<string>;
}>;

export type DataGridConfig<Row extends RowData, M> = Readonly<{
  /** Prefix for control IDs. */
  id: string;
  /** Accessible table name, such as "Sessions". */
  label: string;
  /** Plural noun for search and the result count, such as "sessions". */
  noun: string;
  /** Singular noun for a count of one, such as "session". */
  singular: string;
  rows: ReadonlyArray<Row>;
  rowId: (row: Row) => string;
  /** The first column's text is a button that opens the row. */
  onOpen: (row: Row) => M;
  /** Optional "⋯" actions button per row. */
  actions?: Readonly<{ label: (row: Row) => string; onClick: (row: Row) => M }>;
  columns: ReadonlyArray<GridColumn<Row>>;
  filters?: ReadonlyArray<GridFilter>;
  state: GridState;
  onChange: (state: GridState) => M;
}>;

const features = tableFeatures({
  coreReactivityFeature: storeReactivityBindings(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
});

const hiddenBelow = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

/**
 * Builds the TanStack table for the current state. Construction is cheap for
 * Optio's list sizes, so the view builds it on every render from Model data.
 */
const gridTable = <Row extends RowData, M>(config: DataGridConfig<Row, M>) => {
  const columns = Array.map(config.columns, (column): ColumnDef<typeof features, Row> => ({
    id: column.id,
    accessorFn: column.value,
    sortFn: "alphanumeric" as const,
    sortDescFirst: column.descFirst === true,
    filterFn: "equalsString" as const,
    enableGlobalFilter: column.searchable === true,
  }));
  return constructTable({
    features,
    columns,
    data: config.rows,
    getRowId: config.rowId,
    enableSortingRemoval: false,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) =>
      Array.some(
        config.columns,
        (candidate) => candidate.id === column.id && candidate.searchable === true,
      ),
    state: {
      sorting: config.state.sorting as SortingState,
      globalFilter: config.state.query,
      columnFilters: Array.map(
        Array.filter(Record.toEntries(config.state.filters), ([, value]) => value !== ""),
        ([id, value]) => ({ id, value }),
      ),
    },
  });
};

// ── Toolbar ────────────────────────────────────────────────────────────────

const searchField = <Row extends RowData, M>(config: DataGridConfig<Row, M>, h: H<M>): Ui =>
  h.div.class("relative min-w-0 flex-1 basis-56").children(
    h.label.attr("for", `${config.id}-search`).class("sr-only").children(`Search ${config.noun}`),
    icon(
      h,
      Search,
      "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground",
    ),
    h.input
      .id(`${config.id}-search`)
      .attr("type", "search")
      .class(cn(inputClass, "pl-9"))
      .attr("placeholder", `Search ${config.noun}`)
      .value(config.state.query)
      .attr("autocomplete", "off")
      .on("input", ({ value: query }) => config.onChange({ ...config.state, query })),
  );

const filterField = <Row extends RowData, M>(
  config: DataGridConfig<Row, M>,
  filter: GridFilter,
  h: H<M>,
): Ui => {
  const id = `${config.id}-filter-${filter.columnId}`;
  const current = config.state.filters[filter.columnId] ?? "";
  return h.div.class("relative w-full sm:w-56").children(
    h.label.attr("for", id).class("sr-only").children(filter.label),
    h.select
      .id(id)
      .class(nativeSelectClass)
      .on("change", ({ value }) =>
        config.onChange({
          ...config.state,
          filters: { ...config.state.filters, [filter.columnId]: value },
        }),
      )
      .children(
        h.option
          .attr("value", "")
          .selected(current === "")
          .children(filter.allLabel),
        Array.map(filter.options, (option) =>
          h.option
            .attr("value", option)
            .selected(current === option)
            .children(option),
        ),
      ),
    icon(
      h,
      ChevronDown,
      "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground",
    ),
  );
};

// ── Header and rows ────────────────────────────────────────────────────────

const alignClass = (column: GridColumn<unknown>): string =>
  column.align === "end" ? "text-right" : "text-left";

const sortMark = <M>(sorted: false | "asc" | "desc", h: H<M>): Ui =>
  sorted === false
    ? h.span.class("size-3.5 shrink-0")
    : icon(h, sorted === "asc" ? ArrowUp : ArrowDown, "size-3.5 shrink-0");

const headCell = <Row extends RowData, M>(
  { config, column }: Readonly<{ config: DataGridConfig<Row, M>; column: GridColumn<Row> }>,
  header: Header<typeof features, Row>,
  h: H<M>,
): Ui => {
  const sorted = header.column.getIsSorted();
  const next = header.column.getNextSortingOrder();
  return h.th
    .class(
      cn(
        "h-11 px-3 align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4",
        alignClass(column as GridColumn<unknown>),
        column.from === undefined ? "" : hiddenBelow[column.from],
      ),
    )
    .attr("scope", "col")
    .attr("aria-sort", sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none")
    .children(
      h.button
        .attr("type", "button")
        .class(
          cn(
            "-mx-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            sorted === false ? "" : "text-foreground",
          ),
        )
        .on(
          "click",
          config.onChange({
            ...config.state,
            sorting: [
              { id: column.id, desc: sorted === false ? next === "desc" : sorted === "asc" },
            ],
          }),
        )
        .children(
          column.align === "end"
            ? [sortMark(sorted, h), column.header]
            : [column.header, sortMark(sorted, h)],
        ),
    );
};

const bodyCell = <Row extends RowData, M>(
  { config, column }: Readonly<{ config: DataGridConfig<Row, M>; column: GridColumn<Row> }>,
  row: Row,
  h: H<M>,
): Ui => {
  const isFirst = config.columns[0]!.id === column.id;
  return Table.cell(
    {
      className: cn(
        "h-14 px-3 first:pl-4 tabular",
        alignClass(column as GridColumn<unknown>),
        column.from === undefined ? "" : hiddenBelow[column.from],
        isFirst ? "w-full max-w-0 whitespace-normal" : "text-muted-foreground",
        column.className,
      ),
    },
    [
      isFirst
        ? h.button
            .attr("type", "button")
            .class(
              "block w-full min-w-0 text-left font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring",
            )
            .attr("dir", "auto")
            .on("click", config.onOpen(row))
            .children(column.cell(row))
        : column.cell(row),
    ],
    h,
  );
};

const actionsCell = <Row extends RowData, M>(config: DataGridConfig<Row, M>, row: Row, h: H<M>) =>
  config.actions === undefined
    ? []
    : [
        Table.cell(
          { className: "relative z-10 w-12 py-0 pr-2 pl-0 text-right" },
          [
            h.button
              .attr("type", "button")
              .class(
                "inline-grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              )
              .attr("aria-label", config.actions.label(row))
              .on("click", config.actions.onClick(row))
              .children(icon(h, Ellipsis, "size-5")),
          ],
          h,
        ),
      ];

// ── Grid ───────────────────────────────────────────────────────────────────

/**
 * Searchable, sortable, filterable table shared by History and Templates.
 * TanStack Table derives the visible rows; the Model owns the state and the
 * view sends the next state as one Message. Columns marked `from` hide on
 * narrow screens, so the first column carries their summary there.
 */
export const dataGrid = <Row extends RowData, M>(config: DataGridConfig<Row, M>, h: H<M>): Ui => {
  const table = gridTable(config);
  const rows = table.getRowModel().rows;
  const byId = new Map(Array.map(config.columns, (column) => [column.id, column] as const));
  return h.section
    .class("flex flex-col gap-3")
    .attr("aria-label", config.label)
    .children(
      h.div.class("flex flex-wrap items-center gap-2").children(
        searchField(config, h),
        Array.map(config.filters ?? [], (filter) => filterField(config, filter, h)),
      ),
      h.div
        .class(cn(cardClass, "gap-0 py-0"))
        .attr("data-slot", "grouped-list")
        .attr("data-surface", "card")
        .children(
          Table(
            { className: "table-auto" },
            [
              Table.caption({ className: "sr-only" }, [config.label], h),
              Table.header(
                { className: "bg-muted/40" },
                Array.map(table.getHeaderGroups(), (group) =>
                  h.tr.class("border-b border-border").children(
                    Array.map(group.headers, (header) =>
                      headCell({ config, column: byId.get(header.column.id)! }, header, h),
                    ),
                    config.actions === undefined
                      ? []
                      : [
                          h.th
                            .class("w-12")
                            .attr("scope", "col")
                            .children(h.span.class("sr-only").children("Actions")),
                        ],
                  ),
                ),
                h,
              ),
              Table.body(
                {},
                Array.map(rows, (row) =>
                  h.tr
                    .key(row.id)
                    .class("relative border-b border-border transition-colors hover:bg-muted/50")
                    .children(
                      Array.map(row.getAllCells(), (cell) =>
                        bodyCell({ config, column: byId.get(cell.column.id)! }, row.original, h),
                      ),
                      actionsCell(config, row.original, h),
                    ),
                ),
                h,
              ),
            ],
            h,
          ),
          rows.length === 0
            ? [
                h.p
                  .class("px-4 py-8 text-center text-sm text-muted-foreground")
                  .children(`No ${config.noun} match your search.`),
              ]
            : [],
        ),
      h.p
        .class("text-xs text-muted-foreground tabular")
        .attr("aria-live", "polite")
        .children(
          `${rows.length === config.rows.length ? "" : `${rows.length} of `}${config.rows.length} ${
            config.rows.length === 1 ? config.singular : config.noun
          }`,
        ),
    );
};
