import { Effect } from "effect";
import { Command } from "foldkit";

import { Message } from "../messages";

/** True once the browser has agreed not to evict this site's storage. */
const requestPersistence = async (): Promise<boolean> => {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (storage === undefined || typeof storage.persist !== "function") return false;
  if (await storage.persisted()) return true;
  return storage.persist();
};

/**
 * Asks the browser to keep saved studies when space runs low. Sent when a
 * session starts, so the request follows the user's own action and some
 * browsers (Firefox) show their permission prompt at a meaningful moment;
 * browsers that already decided, or don't support it, answer at once.
 */
export const RequestPersistentStorage = Command.define("RequestPersistentStorage", {
  messages: [Message.PersistentStorageChecked],
  execute: Effect.promise(() =>
    requestPersistence().then(
      (granted) => Message.PersistentStorageChecked({ granted }),
      () => Message.PersistentStorageChecked({ granted: false }),
    ),
  ),
});
