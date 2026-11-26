import { Context, Effect } from "effect";
import { SecureRandom } from "effect/crypto";

/**
 * The randomness record IDs come from: Web Crypto unless a test provides
 * another. A Reference adds no requirement, so Effect UI `Command.make`
 * bodies can draw IDs. Missing Web Crypto is a defect: the app cannot create
 * records without it.
 */
export const IdRandom = Context.Reference<SecureRandom.SecureRandom["Service"]>("optio/IdRandom", {
  defaultValue: () =>
    SecureRandom.make((size) => globalThis.crypto.getRandomValues(new Uint8Array(size))),
});

/** A random UUIDv4 drawn from `IdRandom`. */
export const randomUuid: Effect.Effect<string> = Effect.gen(function* () {
  const random = yield* IdRandom;
  return yield* random.uuidV4();
});

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
  Effect.forEach(items, (item) => Effect.map(randomUuid, (id) => ({ ...item, id })), {
    concurrency: 1,
  });
