import { Effect, Layer } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { isDarkTheme, readTheme, saveTheme, type Theme } from "./theme";
import { readStyle, saveStyle, setCurrentStyle, type FoldcnStyle } from "./style";

// Keep browser access at the application boundary; tests provide layerMemory.
const storageLayer = Layer.unwrap(
  Effect.try(() => globalThis.localStorage).pipe(
    Effect.map((storage) => KeyValueStore.layerStorage(() => storage)),
  ),
);

let currentTheme: Theme = "auto";

const applyTheme = () => {
  document.documentElement.classList.toggle(
    "dark",
    isDarkTheme(currentTheme, window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
};

export const initializeTheme = (): Theme => {
  currentTheme = Effect.runSync(
    readTheme.pipe(
      Effect.provide(storageLayer),
      Effect.catch(() => Effect.succeed("auto" as const)),
    ),
  );
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  return currentTheme;
};

export const changeTheme = (theme: Theme) =>
  Effect.sync(() => {
    currentTheme = theme;
    applyTheme();
  }).pipe(
    Effect.andThen(saveTheme(theme).pipe(Effect.provide(storageLayer))),
    // Retain this visit's selection, but never claim a failed write was saved.
    Effect.match({ onSuccess: () => true, onFailure: () => false }),
  );

export const initializeStyle = (): FoldcnStyle => {
  const style = Effect.runSync(
    readStyle.pipe(
      Effect.provide(storageLayer),
      Effect.catch(() => Effect.succeed("default" as const)),
    ),
  );
  setCurrentStyle(style);
  document.documentElement.dataset.foldcnStyle = style;
  return style;
};

export const changeStyle = (style: FoldcnStyle) =>
  Effect.sync(() => {
    setCurrentStyle(style);
    document.documentElement.dataset.foldcnStyle = style;
  }).pipe(
    Effect.andThen(saveStyle(style).pipe(Effect.provide(storageLayer))),
    Effect.match({ onSuccess: () => true, onFailure: () => false }),
  );
