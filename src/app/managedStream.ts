import { Effect, Queue, Stream } from "effect";

import { openStoreAccess, storeRecovered, type StoreAccess } from "../livestore/access";

type Unsubscribe = () => void;

const releaseAll = (unsubscribes: ReadonlyArray<Unsubscribe>) =>
  Effect.sync(() => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  });

/**
 * Store subscriptions that survive a failed open: the stream emits
 * `unavailable`, waits until any caller (such as a retry) opens the store,
 * then subscribes. Subscriptions are released when the stream stops.
 */
export const storeStream = <Message>(
  unavailable: NoInfer<Message>,
  subscribe: (access: StoreAccess, emit: (message: Message) => void) => ReadonlyArray<Unsubscribe>,
): Stream.Stream<Message> =>
  Stream.callback((queue) => {
    const emit = (message: Message) => {
      Queue.offerUnsafe(queue, message);
    };
    const open: Effect.Effect<StoreAccess> = openStoreAccess.pipe(
      Effect.catch(() =>
        Effect.sync(() => emit(unavailable)).pipe(
          Effect.andThen(storeRecovered),
          Effect.andThen(Effect.suspend(() => open)),
        ),
      ),
    );
    // Waiting for the store stays interruptible; only subscribing is guarded.
    return open.pipe(
      Effect.flatMap((access) =>
        Effect.acquireRelease(
          Effect.sync(() => subscribe(access, emit)),
          releaseAll,
        ),
      ),
      Effect.flatMap(() => Effect.never),
      // `Stream.callback` runs this in a background fiber whose failure would
      // otherwise be dropped, leaving the stream silent forever. End the
      // stream with the cause so subscribers can report it.
      Effect.catchCause((cause) => Queue.failCause(queue, cause)),
    );
  });
