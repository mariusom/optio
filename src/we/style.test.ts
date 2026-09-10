import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

import { buttonClass } from "@/components/ui/button";
import {
  getCurrentStyle,
  getCurrentStyleClasses,
  readStyle,
  saveStyle,
  setCurrentStyle,
} from "./style";

describe("Foldcn component style", () => {
  it.effect("defaults invalid preferences and round-trips every style", () =>
    Effect.gen(function* () {
      expect(yield* readStyle).toBe("nova");
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("optio-foldcn-style", "unknown");
      expect(yield* readStyle).toBe("nova");
      yield* store.set("optio-foldcn-style", "default");
      expect(yield* readStyle).toBe("nova");
      for (const style of [
        "nova",
        "vega",
        "maia",
        "lyra",
        "mira",
        "luma",
        "sera",
        "rhea",
      ] as const) {
        yield* saveStyle(style);
        expect(yield* readStyle).toBe(style);
      }
    }).pipe(Effect.provide(KeyValueStore.layerMemory)),
  );

  it("uses resolved upstream classes while retaining Optio's touch target", async () => {
    await setCurrentStyle("nova");
    const nova = buttonClass();
    await setCurrentStyle("vega");
    const vega = buttonClass();
    await setCurrentStyle("nova");

    expect(vega).not.toBe(nova);
    expect(vega).toContain("h-11");
    expect(vega).toContain("rounded-md");
  });

  it("does not let a pending preset override a newer default selection", async () => {
    const earlier = setCurrentStyle("vega");
    const latest = setCurrentStyle("nova");
    expect(await earlier).toBe(false);
    expect(await latest).toBe(true);
    expect(getCurrentStyle()).toBe("nova");
    expect(getCurrentStyleClasses()).toEqual({});
  });
});
