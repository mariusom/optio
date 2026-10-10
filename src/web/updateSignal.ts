/**
 * Hands the service worker's "update ready" from the entry, which registers
 * the worker before the app starts, to the app's `appUpdates` subscription.
 * An update that arrives before the subscription starts is remembered.
 */
let isUpdateReady = false;
const listeners = new Set<() => void>();

/** Called by the entry's service-worker registration. */
export const signalUpdateReady = () => {
  isUpdateReady = true;
  for (const listener of listeners) listener();
};

/** Calls `listener` now if an update is already ready, and on each later one. */
export const onUpdateReady = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (isUpdateReady) listener();
  return () => {
    listeners.delete(listener);
  };
};
