import { Effect, Schema } from "effect";
import * as KeyValueStore from "effect/persistence/KeyValueStore";

export const Theme = Schema.Literals(["light", "dark", "auto"]);
export type Theme = typeof Theme.Type;
export const Font = Schema.Literals(["sans", "serif", "mono"]);
export type Font = typeof Font.Type;
export const IconLibrary = Schema.Literals(["hugeicons", "lucide"]);
export type IconLibrary = typeof IconLibrary.Type;
const PresetAccent = Schema.Literals(["default", "blue", "violet", "green", "rose"]);
export const HexColour = Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/));
export const Accent = Schema.Union([PresetAccent, HexColour]);
export type Accent = typeof Accent.Type;
/** Whole-app looks: palette, surfaces and typography over the same layout. */
export const Look = Schema.Literals(["classic", "studio", "swiss", "shopfloor", "blueprint"]);
export type Look = typeof Look.Type;
/** Blueprint is the default; a saved choice (including Classic) still wins. */
export const defaultLook: Look = "blueprint";
/** "large" (glove mode) enlarges text, answer choices and primary actions. */
export const ControlSize = Schema.Literals(["standard", "large"]);
export type ControlSize = typeof ControlSize.Type;

export const fonts = Font.literals;
export const accents = PresetAccent.literals;
export const looks = Look.literals;

/**
 * sRGB equivalents of each look's --background (src/looks.css; Classic in
 * src/index.css) for browser chrome, which does not reliably accept oklch().
 */
export const lookThemeColors: Readonly<Record<Look, { light: string; dark: string }>> = {
  classic: { light: "#ffffff", dark: "#0a0a0a" },
  studio: { light: "#faf6f1", dark: "#1a1510" },
  swiss: { light: "#ffffff", dark: "#060606" },
  shopfloor: { light: "#e3e7ea", dark: "#13161a" },
  blueprint: { light: "#ecf7ff", dark: "#09152c" },
};

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
const lookStorageKey = "optio-look";
const controlSizeStorageKey = "optio-control-size";

export const readTheme = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(themeStorageKey);
  return yield* Schema.decodeUnknownEffect(Theme)(value).pipe(
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
  return yield* Schema.decodeUnknownEffect(Font)(value).pipe(
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
  return yield* Schema.decodeUnknownEffect(IconLibrary)(value).pipe(
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
  return yield* Schema.decodeUnknownEffect(Accent)(value).pipe(
    Effect.catch(() => Effect.succeed("default" as const)),
  );
});

export const saveAccent = Effect.fn("saveAccent")(function* (accent: Accent) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(accentStorageKey, accent);
});

export const readLook = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(lookStorageKey);
  return yield* Schema.decodeUnknownEffect(Look)(value).pipe(
    Effect.catch(() => Effect.succeed(defaultLook)),
  );
});

export const saveLook = Effect.fn("saveLook")(function* (look: Look) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(lookStorageKey, look);
});

export const readControlSize = Effect.gen(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const value = yield* store.get(controlSizeStorageKey);
  return yield* Schema.decodeUnknownEffect(ControlSize)(value).pipe(
    Effect.catch(() => Effect.succeed("standard" as const)),
  );
});

export const saveControlSize = Effect.fn("saveControlSize")(function* (size: ControlSize) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(controlSizeStorageKey, size);
});

export const isDarkTheme = (theme: Theme, systemIsDark: boolean): boolean =>
  theme === "dark" || (theme === "auto" && systemIsDark);
