import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import {
  accentForeground,
  accents,
  fonts,
  isDarkTheme,
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
      expect(yield* readTheme).toBe("auto");
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("optio-theme", "invalid");
      expect(yield* readTheme).toBe("auto");
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
        expect(yield* readTheme).toBe(theme);
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("defaults missing and invalid font and accent preferences", () =>
    Effect.gen(function* () {
      expect(yield* readFont).toBe("sans");
      expect(yield* readAccent).toBe("default");
      expect(yield* readIconLibrary).toBe("hugeicons");
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("optio-font", "comic-sans");
      yield* store.set("optio-accent", "invisible");
      yield* store.set("optio-icon-library", "material");
      expect(yield* readFont).toBe("sans");
      expect(yield* readAccent).toBe("default");
      expect(yield* readIconLibrary).toBe("hugeicons");
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("round-trips every font and accent preference", () =>
    Effect.gen(function* () {
      for (const font of fonts) {
        yield* saveFont(font);
        expect(yield* readFont).toBe(font);
      }
      for (const accent of [...accents, "#19aBcD", "#ffffff", "#000000"]) {
        yield* saveAccent(accent);
        expect(yield* readAccent).toBe(accent);
      }
      for (const library of ["lucide", "hugeicons"] as const) {
        yield* saveIconLibrary(library);
        expect(yield* readIconLibrary).toBe(library);
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it.effect("rejects malformed custom colours from storage", () =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      for (const invalid of ["#fff", "#1234567", "#gg1234", "red", "#123456; color: red"]) {
        yield* store.set("optio-accent", invalid);
        expect(yield* readAccent).toBe("default");
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
