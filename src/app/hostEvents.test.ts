import { Effect, Option, Stream } from "effect";
import { Scene } from "foldkit/test";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import { init, update, view, type Model } from "../main";
import { Message } from "../messages";
import { appUpdates } from "../web/appUpdate";
import { signalUpdateReady } from "../web/updateSignal";

const start = init(Option.getOrThrow(fromString("https://optio.test/#/settings"))).model;

const commandsOf = (model: Model, message: Message) =>
  (update(model, message).commands ?? []).map((command) => ({
    name: command.name,
    args: "args" in command ? command.args : undefined,
  }));

describe("system color scheme", () => {
  it("re-applies the scheme when the system changes and the theme follows it", () => {
    expect(
      commandsOf(
        { ...start, theme: "auto" },
        Message.ChangedSystemColorScheme({ prefersDark: true }),
      ),
    ).toEqual([{ name: "ApplyColorScheme", args: { dark: true } }]);
  });

  it("only records the system scheme when a fixed theme is chosen", () => {
    const light = { ...start, theme: "light" as const };
    const changed = update(light, Message.ChangedSystemColorScheme({ prefersDark: true }));
    expect(changed.model.systemPrefersDark).toBe(true);
    expect(changed.commands ?? []).toEqual([]);
  });

  it("applies a newly selected theme against the recorded system scheme", () => {
    const darkSystem = { ...start, systemPrefersDark: true };
    expect(commandsOf(darkSystem, Message.SelectedTheme({ theme: "auto" }))).toEqual([
      { name: "ApplyColorScheme", args: { dark: true } },
      { name: "SaveTheme", args: { theme: "auto" } },
    ]);
    expect(commandsOf(darkSystem, Message.SelectedTheme({ theme: "light" }))[0]).toEqual({
      name: "ApplyColorScheme",
      args: { dark: false },
    });
  });
});

// Renders the whole app view for a Model.
const showing = (model: Model, ...steps: ReadonlyArray<Scene.SceneStep<Model, Message, never>>) =>
  Scene.scene(
    {
      update: (current: Model, _message: Message) => ({ model: current }),
      view: (current: Model, h) => view(current, h).body,
    },
    Scene.given(model),
    ...steps,
  );

describe("app update prompt", () => {
  it("stays hidden until a new version is ready", () =>
    showing(start, Scene.expect(Scene.text("Update ready. Tap to refresh.")).toBeAbsent()));

  it("reloads once on tap and ignores further taps", () => {
    const ready = update(start, Message.AppUpdateReady()).model;
    showing(
      ready,
      Scene.expect(Scene.role("button", { name: "Update ready. Tap to refresh." })).toExist(),
    );

    const applying = update(ready, Message.ClickedApplyUpdate());
    expect(applying.commands?.map((command) => command.name)).toEqual(["ReloadForUpdate"]);
    showing(
      applying.model,
      Scene.expect(Scene.role("button", { name: "Loading update…" })).toBeDisabled(),
    );
    expect(update(applying.model, Message.ClickedApplyUpdate()).commands ?? []).toEqual([]);
  });
});

describe("service worker update hand-off", () => {
  it("delivers an update that arrived before the app subscribed", async () => {
    // The entry registers the worker before the runtime starts subscriptions.
    signalUpdateReady();
    const messages = await Effect.runPromise(appUpdates.pipe(Stream.take(1), Stream.runCollect));
    expect(messages).toEqual([Message.AppUpdateReady()]);
  });
});
