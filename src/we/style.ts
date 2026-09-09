import { Effect, Schema as S } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

export const FoldcnStyle = S.Literals([
  "default",
  "nova",
  "vega",
  "maia",
  "lyra",
  "mira",
  "luma",
  "sera",
  "rhea",
]);
export type FoldcnStyle = typeof FoldcnStyle.Type;
export const foldcnStyles = FoldcnStyle.literals;
const storageKey = "optio-foldcn-style";

let currentStyle: FoldcnStyle = "default";

export const getCurrentStyle = (): FoldcnStyle => currentStyle;
export const setCurrentStyle = (style: FoldcnStyle): void => {
  currentStyle = style;
};

export const readStyle = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(storageKey);
  return yield* S.decodeUnknownEffect(FoldcnStyle)(value).pipe(
    Effect.catch(() => Effect.succeed("default" as const)),
  );
});

export const saveStyle = Effect.fn("saveStyle")(function* (style: FoldcnStyle) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(storageKey, style);
});
