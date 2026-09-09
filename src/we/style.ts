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
  return foldcnStyles.includes(value as FoldcnStyle) ? (value as FoldcnStyle) : "default";
});

export const saveStyle = (style: FoldcnStyle) =>
  Effect.flatMap(KeyValueStore.KeyValueStore, (store) => store.set(storageKey, style));
