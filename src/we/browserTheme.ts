import { Effect } from "effect";
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore";
import iconSvg from "../../public/icon.svg?raw";
import {
  accentForeground,
  isDarkTheme,
  readAccent,
  readFont,
  readIconLibrary,
  readTheme,
  saveAccent,
  saveFont,
  saveIconLibrary,
  saveTheme,
  type Accent,
  type Font,
  type IconLibrary,
  type Theme,
} from "./theme";
import { setCurrentIconLibrary } from "../lib/iconPreference";
import { getCurrentStyle, readStyle, saveStyle, setCurrentStyle, type FoldcnStyle } from "./style";

let currentTheme: Theme = "auto";

const updateFavicon = () => {
  const styles = getComputedStyle(document.documentElement);
  const svg = new DOMParser().parseFromString(iconSvg, "image/svg+xml");
  svg.querySelector("rect")!.setAttribute("fill", styles.getPropertyValue("--primary").trim());
  const text = svg.querySelector("text")!;
  text.setAttribute("fill", styles.getPropertyValue("--primary-foreground").trim());
  text.setAttribute("font-family", styles.fontFamily);
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.append(link);
  }
  link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
};

const applyTheme = () => {
  document.documentElement.classList.toggle(
    "dark",
    isDarkTheme(currentTheme, window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
  updateFavicon();
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
  updateFavicon();
  return font;
});

export const changeFont = Effect.fn("changeFont")(function* (font: Font) {
  document.documentElement.dataset.font = font;
  updateFavicon();
  return yield* saveFont(font).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});

export const initializeIconLibrary = Effect.gen(function* () {
  const library = yield* readIconLibrary.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.catchCause(() => Effect.succeed("hugeicons" as const)),
  );
  setCurrentIconLibrary(library);
  document.documentElement.dataset.iconLibrary = library;
  return library;
});

export const changeIconLibrary = Effect.fn("changeIconLibrary")(function* (library: IconLibrary) {
  setCurrentIconLibrary(library);
  document.documentElement.dataset.iconLibrary = library;
  return yield* saveIconLibrary(library).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});

const applyAccent = (accent: Accent) => {
  const root = document.documentElement;
  root.dataset.accent = accent;
  if (accent.startsWith("#")) {
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--primary-foreground", accentForeground(accent));
    root.style.setProperty("--ring", accent);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--ring");
  }
  updateFavicon();
};

export const initializeAccent = Effect.gen(function* () {
  const accent = yield* readAccent.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.catchCause(() => Effect.succeed("default" as const)),
  );
  applyAccent(accent);
  return accent;
});

export const changeAccent = Effect.fn("changeAccent")(function* (accent: Accent) {
  applyAccent(accent);
  return yield* saveAccent(accent).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
});

export const initializeStyle = Effect.gen(function* () {
  const style = yield* readStyle.pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.catchCause(() => Effect.succeed("nova" as const)),
  );
  yield* Effect.tryPromise(() => setCurrentStyle(style)).pipe(
    // A missing preset must not prevent the app from opening. Keep the saved
    // preference so it can be restored on a subsequent successful load.
    Effect.catch(() => Effect.promise(() => setCurrentStyle("nova"))),
  );
  const appliedStyle = getCurrentStyle();
  document.documentElement.dataset.foldcnStyle = appliedStyle;
  return appliedStyle;
});

export const changeStyle = Effect.fn("changeStyle")(function* (style: FoldcnStyle) {
  const applied = yield* Effect.tryPromise(() => setCurrentStyle(style)).pipe(
    Effect.catch(() => Effect.succeed(null)),
  );
  if (applied === false) return null; // A newer selection superseded this download.
  if (applied === null) return { appliedStyle: getCurrentStyle(), saved: false, loadFailed: true };
  document.documentElement.dataset.foldcnStyle = style;
  const saved = yield* saveStyle(style).pipe(
    Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    Effect.matchCause({ onSuccess: () => true, onFailure: () => false }),
  );
  return { appliedStyle: style, saved, loadFailed: false };
});
