import { Effect, Option, Queue, Stream } from "effect";

/** Each `type` event on `target`, mapped, for as long as the stream runs. */
// The event type is the caller's claim about `type`, which the DOM can't check.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const fromEvent = <E extends Event, A>(
  target: EventTarget,
  type: string,
  map: (event: E) => A,
): Stream.Stream<A> =>
  Stream.callback<A>((queue) => {
    const listener = (event: Event) => Queue.offerUnsafe(queue, map(event as E));
    return Effect.acquireRelease(
      Effect.sync(() => target.addEventListener(type, listener)),
      () => Effect.sync(() => target.removeEventListener(type, listener)),
    );
  });

/**
 * Events that `filterMap` turns into a value; those also have their default
 * prevented, while every other event is left alone.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const fromEventPreventingDefault = <E extends Event, A>(
  target: EventTarget,
  type: string,
  filterMap: (event: E) => Option.Option<A>,
): Stream.Stream<A> =>
  Stream.callback<A>((queue) => {
    const listener = (event: Event) => {
      const value = filterMap(event as E);
      if (Option.isNone(value)) return;
      event.preventDefault();
      Queue.offerUnsafe(queue, value.value);
    };
    return Effect.acquireRelease(
      Effect.sync(() => target.addEventListener(type, listener)),
      () => Effect.sync(() => target.removeEventListener(type, listener)),
    );
  });

/** Whether a media query matches now, then each change. */
export const fromMediaQuery = <A>(query: string, map: (matches: boolean) => A): Stream.Stream<A> =>
  typeof matchMedia !== "function"
    ? Stream.empty
    : Stream.suspend(() => {
        const list = matchMedia(query);
        return Stream.concat(
          Stream.sync(() => map(list.matches)),
          fromEvent<MediaQueryListEvent, A>(list, "change", (event) => map(event.matches)),
        );
      });

const nextFrame: Effect.Effect<void> = Effect.callback<void>((resume) => {
  const id = requestAnimationFrame(() => resume(Effect.void));
  return Effect.sync(() => cancelAnimationFrame(id));
});

/** Waits until the render that caused it is in the document. */
export const afterCommit: Effect.Effect<void> = nextFrame;

/** Waits until that render has been painted. */
export const afterPaint: Effect.Effect<void> = Effect.andThen(nextFrame, nextFrame);
