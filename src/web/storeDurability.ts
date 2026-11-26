import { Duration, Effect, Option, Queue, Stream } from "effect";

import type { StoreAccess } from "../store/access";

/**
 * True once no write is still being saved; false if that takes longer than
 * `timeout`. Each write resolves once its journal entry is saved, so this
 * only waits for writes other commands have started.
 */
export const writesSaved = (store: StoreAccess["store"], timeout: Duration.Input) =>
  Stream.callback<number>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        store.subscribeSyncStatus(({ pendingCount }) => Queue.offerUnsafe(queue, pendingCount)),
      ),
      (unsubscribe) => Effect.sync(unsubscribe),
    ).pipe(Effect.andThen(Effect.never)),
  ).pipe(
    Stream.filter((pendingCount) => pendingCount === 0),
    Stream.runHead,
    Effect.timeoutOption(timeout),
    Effect.map(Option.isSome),
  );
