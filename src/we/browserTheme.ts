import { Effect } from "effect";
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore";
import {
  isDarkTheme,
  readAccent,
  readFont,
  readTheme,
  saveAccent,
  saveFont,
  saveTheme,
  type Accent,
  type Font,
  type Theme,
} from "./theme";
import { readStyle, saveStyle, setCurrentStyle, type FoldcnStyle } from "./style";

let currentTheme: Theme = "auto";

const applyTheme = () => {
  document.documentElement.classList.toggle(
    "dark",
    isDarkTheme(currentTheme, window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
};

export const initializeTheme = Effect.gen(function* () {
  const theme = yield* readTheme.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    // Accessing localStorage itself can fail when browser storage is blocked.
    Effect.catchCause(() => Effect.succeed("auto" as const)),
  );
  currentTheme = theme;
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  return theme;
});

export const changeTheme = Effect.fn("changeTheme")(function* (theme: Theme) {
  currentTheme = theme;
  applyTheme();
  return yield* saveTheme(theme).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});

export const initializeFont = Effect.gen(function* () {
  const font = yield* readFont.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.catchCause(() => Effect.succeed("sans" as const)),
  );
  document.documentElement.dataset.font = font;
  return font;
});

export const changeFont = Effect.fn("changeFont")(function* (font: Font) {
  document.documentElement.dataset.font = font;
  return yield* saveFont(font).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});

export const initializeAccent = Effect.gen(function* () {
  const accent = yield* readAccent.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.catchCause(() => Effect.succeed("default" as const)),
  );
  document.documentElement.dataset.accent = accent;
  return accent;
});

export const changeAccent = Effect.fn("changeAccent")(function* (accent: Accent) {
  document.documentElement.dataset.accent = accent;
  return yield* saveAccent(accent).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});

export const initializeStyle = Effect.gen(function* () {
  const style = yield* readStyle.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.catchCause(() => Effect.succeed("default" as const)),
  );
  setCurrentStyle(style);
  document.documentElement.dataset.foldcnStyle = style;
  return style;
});

export const changeStyle = Effect.fn("changeStyle")(function* (style: FoldcnStyle) {
  setCurrentStyle(style);
  document.documentElement.dataset.foldcnStyle = style;
  return yield* saveStyle(style).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});
