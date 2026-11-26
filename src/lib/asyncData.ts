import { Array, Option, Record, Schema as S } from "effect";

/**
 * Store-backed data in the Model: `Loading` until its subscription first
 * emits, then the rows (`Success`) or a read failure (`Failure`). Pages tell
 * "not read yet" from "empty", so they never flash an empty state.
 */
export type AsyncData<A, E> =
  | Readonly<{ _tag: "Loading" }>
  | Readonly<{ _tag: "Success"; data: A }>
  | Readonly<{ _tag: "Failure"; error: E }>;

export const Loading = (): AsyncData<never, never> => ({ _tag: "Loading" });
export const succeed = <A, E = never>(data: A): AsyncData<A, E> => ({ _tag: "Success", data });
export const fail = <E, A = never>(error: E): AsyncData<A, E> => ({ _tag: "Failure", error });

export const isFailure = <A, E>(
  self: AsyncData<A, E>,
): self is Readonly<{ _tag: "Failure"; error: E }> => self._tag === "Failure";
export const hasData = <A, E>(
  self: AsyncData<A, E>,
): self is Readonly<{ _tag: "Success"; data: A }> => self._tag === "Success";

export const getOrElse = <A, E, B>(self: AsyncData<A, E>, orElse: () => B): A | B =>
  self._tag === "Success" ? self.data : orElse();

export const matchData = <A, E, B, C = B, D = B>(
  self: AsyncData<A, E>,
  handlers: Readonly<{ onEmpty: () => B; onFailure: (error: E) => C; onData: (data: A) => D }>,
): B | C | D =>
  self._tag === "Success"
    ? handlers.onData(self.data)
    : self._tag === "Failure"
      ? handlers.onFailure(self.error)
      : handlers.onEmpty();

type DataOf<T> = Extract<T, { _tag: "Success" }> extends { data: infer A } ? A : never;
type ErrorOf<T> = Extract<T, { _tag: "Failure" }> extends { error: infer E } ? E : never;

/** Every input's data once all have it; the first failure; otherwise Loading. */
export const all = <const R extends Readonly<Record<string, AsyncData<any, any>>>>(
  inputs: R,
): AsyncData<{ -readonly [K in keyof R]: DataOf<R[K]> }, ErrorOf<R[keyof R]>> => {
  const values = Record.values(inputs);
  const failure = Array.findFirst(values, isFailure);
  if (Option.isSome(failure)) return failure.value as never;
  if (!Array.every(values, hasData)) return Loading();
  return succeed(Record.map(inputs, (input) => (input as { data: unknown }).data) as never);
};

/** Schema for an AsyncData field of the Model. */
export const Schema = <A, AI, E, EI>(data: S.Codec<A, AI>, error: S.Codec<E, EI>) =>
  S.Union([
    S.TaggedStruct("Loading", {}),
    S.TaggedStruct("Success", { data }),
    S.TaggedStruct("Failure", { error }),
  ]) as unknown as S.Codec<AsyncData<A, E>, AsyncData<AI, EI>>;
