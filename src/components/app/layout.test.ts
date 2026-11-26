import { Html } from "@effect/ui/html";
import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import type { H, Ui } from "@/lib/view";
import { choiceRows, row } from "./layout";

const Msg = Schema.Struct({ pick: Schema.String });
type Msg = typeof Msg.Type;

const appearance = (selected: string, h: H<Msg>) =>
  choiceRows(
    {
      label: "Appearance",
      choices: ["Light", "Dark", "Automatic"].map((label) => ({
        label,
        selected: label === selected,
        onSelect: { pick: label },
      })),
    },
    h,
  );

/** The appearance picker, holding the picked choice as its Model. */
const Picker = Html.component({
  name: "Picker",
  props: Schema.Struct({ initial: Schema.String }),
  model: Schema.String,
  message: Msg,
}).make({
  init: ($) => $.props.initial,
  update: (_, message) => message.pick,
  view: (h, model) => appearance(model, h),
});

/** Renders a fixed view, for structural assertions. */
const Static = (render: (h: H<Msg>) => Ui) =>
  Html.component({ name: "Static", model: Schema.Null, message: Msg }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) => render(h),
  });

/** The tag of a fixed view's outermost element. */
const tagOf = function* (render: (h: H<Msg>) => Ui) {
  const s = yield* HtmlScene.make(Static(render), {});
  return Locator.elements(s.root)[0]?.tag;
};

const radio = (name: string) => HtmlLocator.role("radio", { name });
const radios = Locator.attr("role", "radio");

describe("choiceRows", () => {
  it.effect("names the group and marks exactly one choice checked", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(Picker, { initial: "Dark" });
      assert.strictEqual(
        s.get(Locator.attr("role", "radiogroup")).attrs?.["aria-label"],
        "Appearance",
      );
      assert.deepStrictEqual(
        s.all(radios).map((n) => n.attrs?.["aria-checked"]),
        ["false", "true", "false"],
      );
    }),
  );

  it.effect("keeps one tab stop on the selected choice", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(Picker, { initial: "Dark" });
      assert.deepStrictEqual(
        s.all(radios).map((n) => n.attrs?.tabindex),
        ["-1", "0", "-1"],
      );
    }),
  );

  for (const [from, key, to] of [
    ["Dark", "ArrowRight", "Automatic"],
    ["Automatic", "ArrowDown", "Light"],
    ["Dark", "ArrowLeft", "Light"],
    ["Light", "ArrowUp", "Automatic"],
    ["Dark", "Home", "Light"],
    ["Light", "End", "Automatic"],
  ] as const) {
    it.effect(`${key} moves the selection from ${from} to ${to}`, () =>
      Effect.gen(function* () {
        const s = yield* HtmlScene.make(Picker, { initial: from });
        s.keydown(radio(from), key);
        assert.isTrue(s.defaultPrevented);
        assert.strictEqual(s.get(radio(to)).attrs?.["aria-checked"], "true");
        assert.strictEqual(s.get(radio(from)).attrs?.["aria-checked"], "false");
      }),
    );
  }

  it.effect("ignores other keys", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(Picker, { initial: "Dark" });
      s.keydown(radio("Dark"), "Tab").expectIgnored();
      assert.isFalse(s.defaultPrevented);
      assert.strictEqual(s.get(radio("Dark")).attrs?.["aria-checked"], "true");
    }),
  );
});

describe("row", () => {
  it.effect("renders a link when given an href and a button when given a click", () =>
    Effect.gen(function* () {
      const link = yield* tagOf((h) => row({ title: "Go", href: "#x" }, h));
      assert.strictEqual(link, "a");
      const button = yield* tagOf((h) => row({ title: "Do", onClick: { pick: "x" } }, h));
      assert.strictEqual(button, "button");
      const plain = yield* tagOf((h) => row({ title: "Info" }, h));
      assert.strictEqual(plain, "div");
    }),
  );

  it.effect("lets long values wrap when asked", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(
        Static((h) => row({ title: "Notes", value: "a very long answer", wrap: true }, h)),
        {},
      );
      const value = Locator.elements(s.root).find((n) =>
        (n.attrs?.class ?? "").split(" ").includes("whitespace-pre-wrap"),
      );
      assert.isDefined(value);
    }),
  );
});
