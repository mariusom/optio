import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import {
  accentForeground,
  accents,
  fonts,
  isDarkTheme,
  looks,
  lookThemeColors,
  readControlSize,
  readLook,
  saveControlSize,
  saveLook,
  readAccent,
  readFont,
  readIconLibrary,
  readTheme,
  saveAccent,
  saveFont,
  saveIconLibrary,
  saveTheme,
} from "./theme";

describe("theme preference", () => {
  it.effect("defaults missing or invalid preferences to Auto", () =>
    Effect.gen(function* () {
      const missing = yield* readTheme;
      expect(missing).toBe("auto");
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("optio-theme", "invalid");
      const invalid = yield* readTheme;
      expect(invalid).toBe("auto");
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it("follows the system only in Auto mode", () => {
    for (const systemIsDark of [false, true]) {
      expect(isDarkTheme("light", systemIsDark)).toBe(false);
      expect(isDarkTheme("dark", systemIsDark)).toBe(true);
      expect(isDarkTheme("auto", systemIsDark)).toBe(systemIsDark);
    }
  });

  it.effect("round-trips and replaces every preference", () =>
    Effect.gen(function* () {
      for (const theme of ["light", "dark", "auto"] as const) {
        yield* saveTheme(theme);
        const savedTheme = yield* readTheme;
        expect(savedTheme).toBe(theme);
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("defaults missing and invalid font and accent preferences", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.all([readFont, readAccent, readIconLibrary], {
        concurrency: 1,
      });
      expect(missing).toEqual(["sans", "default", "hugeicons"]);
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("optio-font", "comic-sans");
      yield* store.set("optio-accent", "invisible");
      yield* store.set("optio-icon-library", "material");
      const invalid = yield* Effect.all([readFont, readAccent, readIconLibrary], {
        concurrency: 1,
      });
      expect(invalid).toEqual(["sans", "default", "hugeicons"]);
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("round-trips every font and accent preference", () =>
    Effect.gen(function* () {
      for (const font of fonts) {
        yield* saveFont(font);
        const savedFont = yield* readFont;
        expect(savedFont).toBe(font);
      }
      for (const accent of [...accents, "#19aBcD", "#ffffff", "#000000"]) {
        yield* saveAccent(accent);
        const savedAccent = yield* readAccent;
        expect(savedAccent).toBe(accent);
      }
      for (const library of ["lucide", "hugeicons"] as const) {
        yield* saveIconLibrary(library);
        const savedIconLibrary = yield* readIconLibrary;
        expect(savedIconLibrary).toBe(library);
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("rejects malformed custom colours from storage", () =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      for (const invalid of ["#fff", "#1234567", "#gg1234", "red", "#123456; color: red"]) {
        yield* store.set("optio-accent", invalid);
        const savedAccent = yield* readAccent;
        expect(savedAccent).toBe("default");
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it("chooses contrast using linear-light luminance, including the crossover", () => {
    expect(accentForeground("#ff0000")).toBe("#000000");
    expect(accentForeground("#0000ff")).toBe("#ffffff");
    expect(accentForeground("#757575")).toBe("#ffffff");
    expect(accentForeground("#767676")).toBe("#000000");
  });
});

describe("look and control size preferences", () => {
  it.effect("default to Swiss and standard controls when missing or invalid", () =>
    Effect.gen(function* () {
      const savedLook = yield* readLook;
      expect(savedLook).toBe("swiss");
      const savedControlSize = yield* readControlSize;
      expect(savedControlSize).toBe("standard");
      const store = yield* KeyValueStore.KeyValueStore;
      for (const [look, size] of [
        ["neon", "huge"],
        ["Studio", "LARGE"],
        ["", "true"],
      ] as const) {
        yield* store.set("optio-look", look);
        yield* store.set("optio-control-size", size);
        const invalidLook = yield* readLook;
        expect(invalidLook).toBe("swiss");
        const invalidSize = yield* readControlSize;
        expect(invalidSize).toBe("standard");
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("round-trip every look and control size", () =>
    Effect.gen(function* () {
      for (const look of looks) {
        yield* saveLook(look);
        const savedLook = yield* readLook;
        expect(savedLook).toBe(look);
      }
      for (const size of ["large", "standard"] as const) {
        yield* saveControlSize(size);
        const savedControlSize = yield* readControlSize;
        expect(savedControlSize).toBe(size);
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it("gives every look an opaque sRGB browser-chrome colour per scheme", () => {
    expect(Object.keys(lookThemeColors)).toEqual([...looks]);
    for (const colors of Object.values(lookThemeColors)) {
      expect(colors.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(colors.dark).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
