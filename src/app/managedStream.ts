import { Effect, Stream } from "effect";

type Unsubscribe = () => void;

const releaseAll = (unsubscribes: ReadonlyArray<Unsubscribe>) =>
  Effect.sync(() => {
    for (const unsubscribe of unsubscribes) unsubscribe();
  });

export const managedStream = <Message>(
  acquire: (
    queue: Parameters<Parameters<typeof Stream.callback<Message>>[0]>[0],
  ) => Effect.Effect<ReadonlyArray<Unsubscribe>>,
): Stream.Stream<Message> =>
  Stream.callback((queue) =>
    Effect.acquireRelease(acquire(queue), releaseAll).pipe(
      Effect.asVoid,
      Effect.flatMap(() => Effect.never),
    ),
  );
