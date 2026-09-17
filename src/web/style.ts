import { Effect, Schema as S } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

export const FoldcnStyle = S.Literals([
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

let currentStyle: FoldcnStyle = "nova";
let selection = 0;
let currentClasses: Readonly<Record<string, string>> = {};

export const getCurrentStyle = (): FoldcnStyle => currentStyle;
export const getCurrentStyleClasses = () => currentClasses;
export const setCurrentStyle = async (style: FoldcnStyle): Promise<boolean> => {
  const request = ++selection;
  // Nova uses the local component classes. Other presets are only needed when
  // selected in Settings or restored from a saved preference.
  const classes =
    style === "nova"
      ? {}
      : (await import("./componentStyles.generated")).foldcnComponentStyles[style]!;
  if (request !== selection) return false;
  currentClasses = classes;
  currentStyle = style;
  return true;
};

export const readStyle = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(storageKey);
  return yield* S.decodeUnknownEffect(FoldcnStyle)(value).pipe(
    Effect.catch(() => Effect.succeed("nova" as const)),
  );
});

export const saveStyle = Effect.fn("saveStyle")(function* (style: FoldcnStyle) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(storageKey, style);
});
