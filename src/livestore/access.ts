import { Effect, Schema } from "effect";

import { getStore, type AppStore } from "./client";

/** The open store with its schema and queries, all loaded on first use. */
export type StoreAccess = { readonly store: AppStore } & typeof import("./modules");

/** The store could not be opened (for example, storage is blocked or locked). */
class StoreUnavailable extends Schema.TaggedError<StoreUnavailable>()("StoreUnavailable", {
  cause: Schema.Defect(),
}) {}

const recoveryListeners = new Set<() => void>();

/** Completes the next time any caller opens the store successfully. */
export const storeRecovered: Effect.Effect<void> = Effect.callback<void>((resume) => {
  const listener = () => resume(Effect.void);
  recoveryListeners.add(listener);
  return Effect.sync(() => {
    recoveryListeners.delete(listener);
  });
});

const notifyRecovered = () => {
  const listeners = [...recoveryListeners];
  recoveryListeners.clear();
  for (const listener of listeners) listener();
};

let wasUnavailable = false;

export const openStoreAccess: Effect.Effect<StoreAccess, StoreUnavailable> = Effect.tryPromise({
  try: () =>
    Promise.all([getStore(), import("./modules")]).then(([store, modules]) => ({
      store,
      ...modules,
    })),
  catch: (cause) => new StoreUnavailable({ cause }),
}).pipe(
  Effect.tap(() =>
    Effect.sync(() => {
      if (!wasUnavailable) return;
      wasUnavailable = false;
      notifyRecovered();
    }),
  ),
  Effect.tapError(() =>
    Effect.sync(() => {
      wasUnavailable = true;
    }),
  ),
);

/** Runs `use` with the open store; fails with StoreUnavailable if it cannot open. */
export const withStore = <A, E, R>(
  use: (access: StoreAccess) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | StoreUnavailable, R> => Effect.flatMap(openStoreAccess, use);
