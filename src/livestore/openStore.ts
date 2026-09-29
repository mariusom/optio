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

// Best effort: ask the browser not to evict studies under storage pressure.
// Browsers may decline or prompt; the app works either way.
const requestPersistentStorage = () => {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Unsupported or blocked; nothing to do.
  }
};

export const openStore = async () => {
  const store = await createStorePromise({
    // Pre-release reset: old events did not contain creation timestamps.
    storeId: "optio-v3",
    schema,
    adapter,
  });
  if (store.storageMode !== "in-memory") requestPersistentStorage();
  return store;
};
