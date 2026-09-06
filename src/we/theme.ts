import { Effect, Schema as S } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

export const Theme = S.Literals(["light", "dark", "auto"]);
export type Theme = typeof Theme.Type;
const storageKey = "optio-theme";

export const readTheme = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(storageKey);
  return value === "light" || value === "dark" ? value : "auto";
});

export const saveTheme = (theme: Theme) =>
  Effect.flatMap(KeyValueStore.KeyValueStore, (store) => store.set(storageKey, theme));

export const isDarkTheme = (theme: Theme, systemIsDark: boolean): boolean =>
  theme === "dark" || (theme === "auto" && systemIsDark);
