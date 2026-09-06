import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { isDarkTheme, readTheme, saveTheme } from "./theme";

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
});
