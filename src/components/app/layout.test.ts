import { inertHtml, type HtmlBuilder } from "foldkit/html";
import * as Scene from "foldkit/scene";
import { describe, expect, it } from "vitest";

import { choiceRows, row } from "./layout";

type Msg = { readonly pick: string };
const h = inertHtml as unknown as HtmlBuilder<Msg>;
type Node = NonNullable<ReturnType<typeof h.div>>;

const nodes = (node: Node | null): Node[] =>
  node === null
    ? []
    : [node, ...(node.children ?? []).flatMap((c) => (typeof c === "object" ? nodes(c) : []))];

describe("choiceRows", () => {
  const view = choiceRows(
    {
      label: "Appearance",
      choices: ["Light", "Dark", "Automatic"].map((label) => ({
        label,
        selected: label === "Dark",
        onSelect: { pick: label },
      })),
    },
    h,
  );
  const all = nodes(view);
  const radios = all.filter((n) => n.data?.attrs?.role === "radio");

  it("names the group and marks exactly one choice checked", () => {
    const group = all.find((n) => n.data?.attrs?.role === "radiogroup");
    expect(group?.data?.attrs?.["aria-label"]).toBe("Appearance");
    expect(radios).toHaveLength(3);
    expect(radios.map((n) => n.data?.attrs?.["aria-checked"])).toEqual(["false", "true", "false"]);
  });

  it("keeps one tab stop on the selected choice", () => {
    expect(radios.map((n) => n.data?.props?.tabIndex)).toEqual([-1, 0, -1]);
  });

  it("moves the selection with arrow keys and wraps", () => {
    const config = {
      view: (selected: string, h: HtmlBuilder<Msg>) =>
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
        ),
      update: (_selected: string, message: Msg) => ({ model: message.pick, outMessage: message }),
    };
    for (const [from, key, to] of [
      ["Dark", "ArrowRight", "Automatic"],
      ["Automatic", "ArrowDown", "Light"],
      ["Dark", "ArrowLeft", "Light"],
      ["Light", "ArrowUp", "Automatic"],
      ["Dark", "Home", "Light"],
      ["Light", "End", "Automatic"],
    ] as const) {
      Scene.scene(
        config,
        Scene.given(from),
        Scene.keydown(Scene.role("radio", { name: from }), key),
        Scene.expectHandled(),
        Scene.expectOutMessage({ pick: to }),
        Scene.expect(Scene.role("radio", { name: to })).toHaveAttr("aria-checked", "true"),
        Scene.expect(Scene.role("radio", { name: from })).toHaveAttr("aria-checked", "false"),
      );
    }
    Scene.scene(
      config,
      Scene.given("Dark"),
      Scene.keydown(Scene.role("radio", { name: "Dark" }), "Tab"),
      Scene.expectIgnored(),
      Scene.expectNoOutMessage(),
      Scene.expect(Scene.role("radio", { name: "Dark" })).toHaveAttr("aria-checked", "true"),
    );
  });
});

describe("row", () => {
  it("renders a link when given an href and a button when given a click", () => {
    expect(row({ title: "Go", href: "#x" }, h)?.sel).toBe("a");
    expect(row({ title: "Do", onClick: { pick: "x" } }, h)?.sel).toBe("button");
    expect(row({ title: "Info" }, h)?.sel).toBe("div");
  });

  it("lets long values wrap when asked", () => {
    const value = nodes(row({ title: "Notes", value: "a very long answer", wrap: true }, h)).find(
      (n) =>
        String(n.data?.class ?? "").includes("whitespace-pre-wrap") ||
        Object.keys(n.data?.class ?? {}).includes("whitespace-pre-wrap"),
    );
    expect(value).toBeDefined();
  });
});
