// Backup restore guard: decides which IDs a restore may insert. An ID is free
// when no row has it and nothing earlier in the same restore claimed it, so a
// backup that repeats an ID can never insert it twice (a UNIQUE failure inside
// a materializer leaves the store unusable).

type RowQuery = (input: {
  query: string;
  bindValues: Record<string, string>;
}) => ReadonlyArray<unknown>;

/** Returns `claim(table, ids)`: true, and reserves them, only if every ID is free. */
export const idClaimer = (query: RowQuery) => {
  const taken = new Set<string>();
  return (table: string, ids: ReadonlyArray<string>): boolean => {
    const keys = ids.map((id) => `${table}:${id}`);
    const free =
      new Set(keys).size === keys.length &&
      ids.every(
        (id, index) =>
          !taken.has(keys[index]!) &&
          query({ query: `select 1 from ${table} where id = $id`, bindValues: { id } }).length ===
            0,
      );
    if (free) for (const key of keys) taken.add(key);
    return free;
  };
};
