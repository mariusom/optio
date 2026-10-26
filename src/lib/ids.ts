import { Crypto, Effect } from "effect";

/** A random UUIDv4 from Effect's Crypto service (Web Crypto in the browser).
 * Missing Web Crypto is a defect: the app cannot create records without it. */
export const randomUuid: Effect.Effect<string, never, Crypto.Crypto> = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  return yield* crypto.randomUUIDv4();
}).pipe(Effect.orDie);

/** Runs a pure builder that draws IDs from `newId`, supplying random UUIDs.
 * A first run counts the draws, so the builder must be deterministic. */
export const withRandomUuids = <A>(build: (newId: () => string) => A) =>
  Effect.gen(function* () {
    let draws = 0;
    build(() => `${draws++}`);
    const ids = yield* Effect.replicateEffect(randomUuid, draws);
    let next = 0;
    return build(() => ids[next++] ?? "");
  });

/** Copies items with fresh random IDs. */
export const withFreshIds = <A extends { readonly id: string }>(items: ReadonlyArray<A>) =>
  Effect.forEach(items, (item) => Effect.map(randomUuid, (id) => ({ ...item, id })));
