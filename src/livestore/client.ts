import type { openStore } from "./openStore.ts";

/**
 * Imperative handle on the LiveStore store — FoldKit has no hook bridge,
 * so Commands/Subscriptions await this promise directly.
 *
 * `createStorePromise` builds a *new* store per call (it grabs the
 * tablespace lock via a SharedWorker), so the promise is memoized: every
 * caller shares one store instance. Calling it repeatedly would create
 * competing store attempts on the same storeId — every call after the
 * first hangs awaiting the lock and the app deadlocks into empty states.
 */
export type AppStore = Awaited<ReturnType<typeof openStore>>;

let storePromise: Promise<AppStore> | null = null;

// SQLite/Wasm must not block evaluation of the initial render's module graph.
export const getStore = () =>
  (storePromise ??= import("./openStore.ts").then(({ openStore }) => openStore()));
