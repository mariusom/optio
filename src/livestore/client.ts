import { makePersistedAdapter } from "@livestore/adapter-web";
import LiveStoreSharedWorker from "@livestore/adapter-web/shared-worker?sharedworker";
import { createStorePromise } from "@livestore/livestore";
import { schema } from "./schema.ts";
import LiveStoreWorker from "./livestore.worker.ts?worker";

// OPFS-persisted, multi-tab capable adapter — data survives reloads and works offline.
const adapter = makePersistedAdapter({
  storage: { type: "opfs" },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
});

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
let storePromise: Promise<AppStore> | null = null;

export const getStore = () =>
  (storePromise ??= createStorePromise({
    storeId: "watchfuleye-v1",
    schema,
    adapter,
  }));

export type AppStore = Awaited<ReturnType<typeof getStore>>;
