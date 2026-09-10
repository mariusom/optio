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

export const openStore = () =>
  createStorePromise({
    // Pre-release reset: old events did not contain creation timestamps.
    storeId: "optio-v3",
    schema,
    adapter,
  });
