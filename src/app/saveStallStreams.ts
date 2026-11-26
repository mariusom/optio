import { Duration, Effect, Stream } from "effect";

import { Message } from "../messages";
import { storeStream } from "./managedStream";

/**
 * A write still unsaved this long means the browser's storage has stopped
 * responding, so new work may never reach disk; normal writes save well
 * within a second.
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
