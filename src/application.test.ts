import { describe, expect, it } from "vite-plus/test";
import { Schema } from "effect";
import { Story } from "@effect/ui/testing";
import { App } from "./application.ts";
import { Flags, initWithFlags } from "./main.ts";
import { Message } from "./messages.ts";
import { parseRoute } from "./web/routes.ts";

const flags = Schema.decodeSync(Flags)({
  assistantAccess: "approved",
  theme: "dark",
  style: "lyra",
  font: "serif",
  iconLibrary: "lucide",
  accent: "rose",
  look: "blueprint",
  controlSize: "large",
  now: 1_700_000_000_000,
  idSeed: "boot-seed",
});

// Regression guard: the mounted root MUST carry the app's subscriptions.
// Previously entry.ts built the runtime without them, so none of the
// store→model streams (templates, history, details, active session, runner,
// ticker) ever started — the store wrote and persisted data, but the UI
// showed empty states forever.
describe("application wiring", () => {
  it("runs the always-on app subscriptions from the root component on Start", () => {
    const names = Story.start(App, flags)
      .subscriptions.map((key) => key.split(":")[0])
      .toSorted();
    expect(names).toEqual(
      [
        "activeSession",
        "agentRequest",
        "appUpdates",
        "history",
        "links",
        "route",
        "saveStall",
        "storage",
        "systemColorScheme",
      ].toSorted(),
    );
  });

  it("maps hash changes to routes", () => {
    expect(Message.GotRoute({ route: parseRoute("#/history/session-42") })).toEqual({
      _tag: "GotRoute",
      route: { _tag: "SessionDetail", sessionId: "session-42" },
    });
  });

  it("starts from decoded Flags carrying saved preferences, the boot time and ID seed", () => {
    const { model } = initWithFlags(flags, "#/history");
    expect(model).toMatchObject({
      route: { _tag: "HistoryTab" },
      theme: "dark",
      style: "lyra",
      font: "serif",
      iconLibrary: "lucide",
      accent: "rose",
      look: "blueprint",
      controlSize: "large",
      now: 1_700_000_000_000,
      idSeed: "boot-seed",
      idCounter: 0,
    });
    expect(() => Schema.decodeUnknownSync(Flags)({ ...flags, theme: "neon" })).toThrow();
    for (const invalid of [{ look: "neon" }, { controlSize: "huge" }, { look: undefined }]) {
      expect(() => Schema.decodeUnknownSync(Flags)({ ...flags, ...invalid })).toThrow();
    }
  });
});
