import { Array, Order, Record } from "effect";

// The store's state: one Map of rows per table, rebuilt from the event journal
// when the store opens. Rows are replaced, never mutated, so results already
// handed to subscribers stay as they were.

export type TemplateRow = {
  readonly id: string;
  readonly name: string;
  /** 0/1, as stored rows always had it. */
  readonly isDefault: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type FieldColumns = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: number;
  readonly defaultValue: string;
  readonly sortOrder: number;
  /** JSON-encoded string arrays. */
  readonly optionsJson: string;
  readonly exclusiveOptionsJson: string;
};

export type TemplateFieldRow = FieldColumns & { readonly templateId: string };

/** Live and archived sessions; `endedAt === null` means live. */
export type SessionRow = {
  readonly id: string;
  readonly templateId: string | null;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
};

export type SessionTaskRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly orderIndex: number;
  readonly taskType: string;
  readonly endDate: Date | null;
  readonly isBeingEdited: number;
  /** Field values from before an edit started, by field ID. */
  readonly editBackup: { readonly [fieldId: string]: string } | null;
};

export type SessionTaskFieldRow = FieldColumns & {
  readonly taskId: string;
  readonly value: string;
  readonly startDate: Date | null;
};

export type TaskRecordRow = {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: number;
  readonly taskType: string;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
};

export type TaskSectionRow = {
  readonly id: string;
  readonly taskRecordId: string;
  readonly sectionName: string;
  readonly value: string;
  readonly sectionType: string;
  readonly isRequired: number;
  readonly startedAt: Date | null;
  /** Question order within the task; readers sort by it. */
  readonly position: number;
};

export interface StoreState {
  readonly templates: Map<string, TemplateRow>;
  readonly templateFields: Map<string, TemplateFieldRow>;
  readonly sessions: Map<string, SessionRow>;
  readonly sessionTasks: Map<string, SessionTaskRow>;
  readonly sessionTaskFields: Map<string, SessionTaskFieldRow>;
  readonly taskRecords: Map<string, TaskRecordRow>;
  readonly taskSectionRecords: Map<string, TaskSectionRow>;
}

export const emptyState = (): StoreState => ({
  templates: new Map(),
  templateFields: new Map(),
  sessions: new Map(),
  sessionTasks: new Map(),
  sessionTaskFields: new Map(),
  taskRecords: new Map(),
  taskSectionRecords: new Map(),
});

export type TableName = keyof StoreState;
export type RowOf<T extends TableName> = StoreState[T] extends Map<string, infer R> ? R : never;

/** A read of the state; `store.query` runs it and `store.subscribe` re-runs it on change. */
export interface Query<A> {
  readonly run: (state: StoreState) => A;
}

/** Column filters: a value matches exactly; `{ op: "!=", value }` excludes it. */
export type Where<Row> = {
  readonly [K in keyof Row]?: Row[K] | { readonly op: "!="; readonly value: Row[K] };
};

const isNotEqual = (filter: unknown): filter is { readonly op: "!="; readonly value: unknown } =>
  typeof filter === "object" && filter !== null && "op" in filter && filter.op === "!=";

const matches =
  <Row>(where: Where<Row>) =>
  (row: Row): boolean =>
    Array.every(Record.toEntries(where), ([column, filter]) => {
      const value = row[column as keyof Row];
      return isNotEqual(filter) ? value !== filter.value : value === filter;
    });

type Comparable = string | number | Date | null;

const compareValues = (a: Comparable, b: Comparable): -1 | 0 | 1 => {
  if (a === b) return 0;
  // SQL sorts nulls first in ascending order.
  if (a === null) return -1;
  if (b === null) return 1;
  const left = a instanceof Date ? a.getTime() : a;
  const right = b instanceof Date ? b.getTime() : b;
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

/** Order rows by one column; ties keep insertion order. */
export const byColumn = <Row>(
  column: keyof Row,
  direction: "asc" | "desc" = "asc",
): Order.Order<Row> => {
  const order: Order.Order<Row> = (a, b) =>
    compareValues(a[column] as Comparable, b[column] as Comparable);
  return direction === "asc" ? order : Order.flip(order);
};

/** Rows of one table, filtered and optionally sorted, built up as `select().where(...)`. */
export interface Select<Row> extends Query<ReadonlyArray<Row>> {
  readonly table: TableName;
  readonly filters: Where<Row>;
  readonly where: (filters: Where<Row>) => Select<Row>;
  readonly orderBy: (column: keyof Row, direction: "asc" | "desc") => Select<Row>;
}

const select = <Row>(
  table: TableName,
  filters: Where<Row>,
  order?: Order.Order<Row>,
): Select<Row> => ({
  table,
  filters,
  where: (more) => select(table, { ...filters, ...more }, order),
  orderBy: (column, direction) => select(table, filters, byColumn(column, direction)),
  run: (state) => {
    const rows = Array.filter(
      globalThis.Array.from(state[table].values() as Iterable<Row>),
      matches(filters),
    );
    return order === undefined ? rows : Array.sort(rows, order);
  },
});

const table = <T extends TableName>(name: T) => ({
  select: () => select<RowOf<T>>(name, {}),
});

export const tables = {
  templates: table("templates"),
  templateFields: table("templateFields"),
  sessions: table("sessions"),
  sessionTasks: table("sessionTasks"),
  sessionTaskFields: table("sessionTaskFields"),
  taskRecords: table("taskRecords"),
  taskSectionRecords: table("taskSectionRecords"),
};

// ── Writes, for the event handlers ─────────────────────────────────────────

export const insert = <T extends TableName>(state: StoreState, name: T, row: RowOf<T>) => {
  (state[name] as Map<string, RowOf<T>>).set((row as { readonly id: string }).id, row);
};

export const rowsWhere = <T extends TableName>(
  state: StoreState,
  name: T,
  where: Where<RowOf<T>>,
): ReadonlyArray<RowOf<T>> => select<RowOf<T>>(name, where).run(state);

export const updateWhere = <T extends TableName>(
  state: StoreState,
  name: T,
  { where, set }: { readonly where: Where<RowOf<T>>; readonly set: Partial<RowOf<T>> },
) => {
  for (const row of rowsWhere(state, name, where))
    insert(state, name, { ...(row as object), ...set } as RowOf<T>);
};

export const deleteWhere = <T extends TableName>(
  state: StoreState,
  name: T,
  where: Where<RowOf<T>>,
) => {
  for (const row of rowsWhere(state, name, where))
    state[name].delete((row as { readonly id: string }).id);
};
