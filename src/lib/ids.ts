import { Effect } from "effect";
import { SecureRandom } from "effect/crypto";

/** A random UUIDv4 from Effect's SecureRandom service (Web Crypto in the browser).
 * Missing Web Crypto is a defect: the app cannot create records without it. */
export const randomUuid: Effect.Effect<string, never, SecureRandom.SecureRandom> = Effect.gen(
  function* () {
    const secureRandom = yield* SecureRandom.SecureRandom;
    return yield* secureRandom.uuidV4();
  },
);

/** Runs a pure builder that draws IDs from `newId`, supplying random UUIDs.
 * A first run counts the draws, so the builder must be deterministic. */
export const withRandomUuids = Effect.fnUntraced(function* <A>(build: (newId: () => string) => A) {
  let draws = 0;
  build(() => `${draws++}`);
  const ids = yield* Effect.replicateEffect(randomUuid, draws);
  let next = 0;
  return build(() => ids[next++] ?? "");
});

/** Copies items with fresh random IDs. */
export const withFreshIds = <A extends { readonly id: string }>(items: ReadonlyArray<A>) =>
  Effect.forEach(items, (item) => Effect.map(randomUuid, (id) => ({ ...item, id })));
