import { Duration, Effect, Stream } from "effect";

import { Message } from "../messages";
import { storeStream } from "./managedStream";

/**
 * Writes left unconfirmed this long mean the store has stopped saving. A
 * browser crash in the middle of a commit can leave LiveStore's state and
 * event log out of step, after which new work shows on screen but never
 * reaches disk; normal writes confirm well within a second.
 */
const stallAfter = Duration.seconds(20);

/** Reports when saving stalls, and when it recovers. */
export const saveStallStream: Stream.Stream<Message> = storeStream<boolean>(
  false,
  ({ store }, emit) => [store.subscribeSyncStatus((status) => emit(status.pendingCount > 0))],
).pipe(
  Stream.changes,
  Stream.switchMap((pending) =>
    pending
      ? Stream.fromEffect(
          Effect.sleep(stallAfter).pipe(Effect.as(Message.SaveStalled({ stalled: true }))),
        )
      : Stream.succeed(Message.SaveStalled({ stalled: false })),
  ),
);
