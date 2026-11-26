import type { openStore } from "./openStore.ts";

/**
 * The open store. Commands and subscriptions await this promise directly.
 *
 * The promise is memoized so every caller shares one store: a tab holds the
 * store lock once it opens, and a second store in the same tab would replay
 * the journal into tables no one else sees.
 *
 * A failed open is not memoized: the next caller (a retry) opens afresh.
 */
export type AppStore = Awaited<ReturnType<typeof openStore>>;

let storePromise: Promise<AppStore> | null = null;

// The EventLog runtime must not block evaluation of the initial render's module graph.
export const getStore = (): Promise<AppStore> => {
  if (storePromise !== null) return storePromise;
  const opening = import("./openStore.ts").then(({ openStore }) => openStore());
  storePromise = opening;
  opening.catch(() => {
    if (storePromise === opening) storePromise = null;
  });
  return opening;
};
