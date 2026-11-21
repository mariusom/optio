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
import type { Html, HtmlBuilder } from "foldkit/html";

import { inputClass } from "@/components/ui/input";
import { nativeSelectClass } from "@/components/ui/native-select";
import { Table } from "@/components/ui/table";
import { cardClass } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ChevronDown, Ellipsis, Search, icon } from "./icons";

type Child = Html | string;

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

const searchField = <Row extends RowData, M>(
  config: DataGridConfig<Row, M>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class("relative min-w-0 flex-1 basis-56")],
    [
      h.label([h.For(`${config.id}-search`), h.Class("sr-only")], [`Search ${config.noun}`]),
      icon(
        h,
        Search,
        "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground",
      ),
      h.input([
        h.Id(`${config.id}-search`),
        h.Type("search"),
        h.Class(cn(inputClass, "pl-9")),
        h.Placeholder(`Search ${config.noun}`),
        h.Value(config.state.query),
        h.Autocomplete("off"),
        h.OnInput((query) => config.onChange({ ...config.state, query })),
      ]),
    ],
  );

const filterField = <Row extends RowData, M>(
  config: DataGridConfig<Row, M>,
  filter: GridFilter,
  h: HtmlBuilder<M>,
): Html => {
  const id = `${config.id}-filter-${filter.columnId}`;
  const current = config.state.filters[filter.columnId] ?? "";
  return h.div(
    [h.Class("relative w-full sm:w-56")],
    [
      h.label([h.For(id), h.Class("sr-only")], [filter.label]),
      h.select(
        [
          h.Id(id),
          h.Class(nativeSelectClass),
          h.OnChange((value) =>
            config.onChange({
              ...config.state,
              filters: { ...config.state.filters, [filter.columnId]: value },
            }),
          ),
        ],
        [
          h.option([h.Value(""), h.Selected(current === "")], [filter.allLabel]),
          ...Array.map(filter.options, (option) =>
            h.option([h.Value(option), h.Selected(current === option)], [option]),
          ),
        ],
      ),
      icon(
        h,
        ChevronDown,
        "pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground",
      ),
    ],
  );
};

// ── Header and rows ────────────────────────────────────────────────────────

const alignClass = (column: GridColumn<unknown>): string =>
  column.align === "end" ? "text-right" : "text-left";

const sortMark = <M>(sorted: false | "asc" | "desc", h: HtmlBuilder<M>): Html =>
  sorted === false
    ? h.span([h.Class("size-3.5 shrink-0")])
    : icon(h, sorted === "asc" ? ArrowUp : ArrowDown, "size-3.5 shrink-0");

const headCell = <Row extends RowData, M>(
  { config, column }: Readonly<{ config: DataGridConfig<Row, M>; column: GridColumn<Row> }>,
  header: Header<typeof features, Row>,
  h: HtmlBuilder<M>,
): Html => {
  const sorted = header.column.getIsSorted();
  const next = header.column.getNextSortingOrder();
  return h.th(
    [
      h.Class(
        cn(
          "h-11 px-3 align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4",
          alignClass(column as GridColumn<unknown>),
          column.from === undefined ? "" : hiddenBelow[column.from],
        ),
      ),
      h.Scope("col"),
      h.AriaSort(sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"),
    ],
    [
      h.button(
        [
          h.Type("button"),
          h.Class(
            cn(
              "-mx-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              sorted === false ? "" : "text-foreground",
            ),
          ),
          h.OnClick(
            config.onChange({
              ...config.state,
              sorting: [
                { id: column.id, desc: sorted === false ? next === "desc" : sorted === "asc" },
              ],
            }),
          ),
        ],
        // End-aligned headers put the arrow first, so their text lines up with the numbers.
        column.align === "end"
          ? [sortMark(sorted, h), column.header]
          : [column.header, sortMark(sorted, h)],
      ),
    ],
  );
};

const bodyCell = <Row extends RowData, M>(
  { config, column }: Readonly<{ config: DataGridConfig<Row, M>; column: GridColumn<Row> }>,
  row: Row,
  h: HtmlBuilder<M>,
): Html => {
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
        ? h.button(
            [
              h.Type("button"),
              // The whole row is the target; the name stays the accessible label.
              h.Class(
                "block w-full min-w-0 text-left font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring",
              ),
              h.Dir("auto"),
              h.OnClick(config.onOpen(row)),
            ],
            [column.cell(row)],
          )
        : column.cell(row),
    ],
    h,
  );
};

const actionsCell = <Row extends RowData, M>(
  config: DataGridConfig<Row, M>,
  row: Row,
  h: HtmlBuilder<M>,
) =>
  config.actions === undefined
    ? []
    : [
        Table.cell(
          { className: "relative z-10 w-12 py-0 pr-2 pl-0 text-right" },
          [
            h.button(
              [
                h.Type("button"),
                h.Class(
                  "inline-grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                ),
                h.AriaLabel(config.actions.label(row)),
                h.OnClick(config.actions.onClick(row)),
              ],
              [icon(h, Ellipsis, "size-5")],
            ),
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
export const dataGrid = <Row extends RowData, M>(
  config: DataGridConfig<Row, M>,
  h: HtmlBuilder<M>,
): Html => {
  const table = gridTable(config);
  const rows = table.getRowModel().rows;
  const byId = new Map(Array.map(config.columns, (column) => [column.id, column] as const));
  return h.section(
    [h.Class("flex flex-col gap-3"), h.AriaLabel(config.label)],
    [
      h.div(
        [h.Class("flex flex-wrap items-center gap-2")],
        [
          searchField(config, h),
          ...Array.map(config.filters ?? [], (filter) => filterField(config, filter, h)),
        ],
      ),
      h.div(
        [
          h.Class(cn(cardClass, "gap-0 py-0")),
          h.DataAttribute("slot", "grouped-list"),
          h.DataAttribute("surface", "card"),
        ],
        [
          Table(
            { className: "table-auto" },
            [
              Table.caption({ className: "sr-only" }, [config.label], h),
              Table.header(
                { className: "bg-muted/40" },
                Array.map(table.getHeaderGroups(), (group) =>
                  h.tr(
                    [h.Class("border-b border-border")],
                    [
                      ...Array.map(group.headers, (header) =>
                        headCell({ config, column: byId.get(header.column.id)! }, header, h),
                      ),
                      ...(config.actions === undefined
                        ? []
                        : [
                            h.th(
                              [h.Class("w-12"), h.Scope("col")],
                              [h.span([h.Class("sr-only")], ["Actions"])],
                            ),
                          ]),
                    ],
                  ),
                ),
                h,
              ),
              Table.body(
                {},
                Array.map(rows, (row) =>
                  h.keyed("tr")(
                    row.id,
                    [
                      h.Class(
                        "relative border-b border-border transition-colors hover:bg-muted/50",
                      ),
                    ],
                    [
                      ...Array.map(row.getAllCells(), (cell) =>
                        bodyCell({ config, column: byId.get(cell.column.id)! }, row.original, h),
                      ),
                      ...actionsCell(config, row.original, h),
                    ],
                  ),
                ),
                h,
              ),
            ],
            h,
          ),
          ...(rows.length === 0
            ? [
                h.p(
                  [h.Class("px-4 py-8 text-center text-sm text-muted-foreground")],
                  [`No ${config.noun} match your search.`],
                ),
              ]
            : []),
        ],
      ),
      h.p(
        [h.Class("text-xs text-muted-foreground tabular"), h.AriaLive("polite")],
        [
          `${rows.length === config.rows.length ? "" : `${rows.length} of `}${config.rows.length} ${
            config.rows.length === 1 ? config.singular : config.noun
          }`,
        ],
      ),
    ],
  );
};
