/**
 * Shared LiveStore row → domain-value helpers.
 *
 * The template/task field rows are JSON-string-encoded for the options
 * columns; every command module previously re-implemented the same
 * `safeArray` parse and `fieldRowsToDefs` mapping (3–4 copies each).
 */

import type { FieldDef } from "../livestore/schema";

export const safeArray = (json: string): ReadonlyArray<string> => {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** A template-field row as returned by LiveStore (options in JSON columns). */
export type FieldRow = {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: number;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly optionsJson: string;
  readonly exclusiveOptionsJson: string;
};

export const fieldRowsToDefs = (rows: ReadonlyArray<FieldRow>): ReadonlyArray<FieldDef> =>
  rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as FieldDef["kind"],
    isRequired: row.isRequired === 1,
    defaultValue: row.defaultValue,
    sortOrder: row.sortOrder,
    options: safeArray(row.optionsJson),
    exclusiveOptions: safeArray(row.exclusiveOptionsJson),
  }));
