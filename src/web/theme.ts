import { Effect, Schema as S } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

export const Theme = S.Literals(["light", "dark", "auto"]);
export type Theme = typeof Theme.Type;
export const Font = S.Literals(["sans", "serif", "mono"]);
export type Font = typeof Font.Type;
export const IconLibrary = S.Literals(["hugeicons", "lucide"]);
export type IconLibrary = typeof IconLibrary.Type;
const PresetAccent = S.Literals(["default", "blue", "violet", "green", "rose"]);
export const HexColour = S.String.check(S.isPattern(/^#[0-9a-fA-F]{6}$/));
export const Accent = S.Union([PresetAccent, HexColour]);
export type Accent = typeof Accent.Type;

export const fonts = Font.literals;
export const accents = PresetAccent.literals;

/** Choose the higher-contrast foreground for a validated sRGB hex colour. */
export const accentForeground = (hex: string): "#000000" | "#ffffff" => {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
};

const themeStorageKey = "optio-theme";
const fontStorageKey = "optio-font";
const accentStorageKey = "optio-accent";
const iconLibraryStorageKey = "optio-icon-library";

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

export const readIconLibrary = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(iconLibraryStorageKey);
  return yield* S.decodeUnknownEffect(IconLibrary)(value).pipe(
    Effect.catch(() => Effect.succeed("hugeicons" as const)),
  );
});

export const saveIconLibrary = Effect.fn("saveIconLibrary")(function* (library: IconLibrary) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(iconLibraryStorageKey, library);
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
