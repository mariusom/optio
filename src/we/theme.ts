import { Effect, Schema as S } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

export const Theme = S.Literals(["light", "dark", "auto"]);
export type Theme = typeof Theme.Type;
export const Font = S.Literals(["sans", "serif", "mono"]);
export type Font = typeof Font.Type;
export const Accent = S.Literals(["default", "blue", "violet", "green", "rose"]);
export type Accent = typeof Accent.Type;

export const fonts = Font.literals;
export const accents = Accent.literals;

const themeStorageKey = "optio-theme";
const fontStorageKey = "optio-font";
const accentStorageKey = "optio-accent";

export const readTheme = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(themeStorageKey);
  return yield* S.decodeUnknownEffect(Theme)(value).pipe(
    Effect.catch(() => Effect.succeed("auto" as const)),
  );
});

export const saveTheme = Effect.fn("saveTheme")(function* (theme: Theme) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(themeStorageKey, theme);
});

export const readFont = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(fontStorageKey);
  return yield* S.decodeUnknownEffect(Font)(value).pipe(
    Effect.catch(() => Effect.succeed("sans" as const)),
  );
});

export const saveFont = Effect.fn("saveFont")(function* (font: Font) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(fontStorageKey, font);
});

export const readAccent = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(accentStorageKey);
  return yield* S.decodeUnknownEffect(Accent)(value).pipe(
    Effect.catch(() => Effect.succeed("default" as const)),
  );
});

export const saveAccent = Effect.fn("saveAccent")(function* (accent: Accent) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(accentStorageKey, accent);
});

export const isDarkTheme = (theme: Theme, systemIsDark: boolean): boolean =>
  theme === "dark" || (theme === "auto" && systemIsDark);
