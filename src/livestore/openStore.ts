import { makePersistedAdapter } from "@livestore/adapter-web";
import LiveStoreSharedWorker from "@livestore/adapter-web/shared-worker?sharedworker";
import { createStorePromise } from "@livestore/livestore";
import { schema } from "./schema.ts";
import { storageResetKey } from "./resetFlag";
import LiveStoreWorker from "./livestore.worker.ts?worker";

const resetRequested = (): boolean => {
  try {
    return localStorage.getItem(storageResetKey) === "1";
  } catch {
    return false;
  }
};

// OPFS-persisted, multi-tab capable adapter — data survives reloads and works offline.
// `resetPersistence` erases both the state and event log databases: the only way
// out of a store that a crash left unable to save (see saveStallStreams).
const makeAdapter = (resetPersistence: boolean) =>
  makePersistedAdapter({
    storage: { type: "opfs" },
    worker: LiveStoreWorker,
    sharedWorker: LiveStoreSharedWorker,
    resetPersistence,
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
  const reset = resetRequested();
  const store = await createStorePromise({
    // Pre-release reset: old events did not contain creation timestamps.
    storeId: "optio-v3",
    schema,
    adapter: makeAdapter(reset),
  });
  if (reset) {
    try {
      localStorage.removeItem(storageResetKey);
    } catch {
      // The flag stays; the next open resets again, which is still empty.
    }
  }
  if (store.storageMode !== "in-memory") requestPersistentStorage();
  return store;
};
