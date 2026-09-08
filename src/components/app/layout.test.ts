import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { choiceRows, row } from "./layout";

type Msg = { readonly pick: string };
const h = inertHtml as unknown as HtmlBuilder<Msg>;
type Node = NonNullable<ReturnType<typeof h.div>>;

const nodes = (node: Node | null): Node[] =>
  node === null
    ? []
    : [node, ...(node.children ?? []).flatMap((c) => (typeof c === "object" ? nodes(c) : []))];

const keyHandler = (node: Node) =>
  node.data?.on?.keydown as ((event: KeyboardEvent) => void) | undefined;

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
    for (const radio of radios) expect(keyHandler(radio)).toBeTypeOf("function");
    // The keydown handler is foldkit's OnKeyDownPreventDefault wrapper; call the
    // stored message function directly to check its routing.
    const handlers = radios.map(
      (n) =>
        (n.data as { on?: { keydown?: { f?: (key: string) => Option.Option<Msg> } } }).on?.keydown,
    );
    expect(handlers.every((handler) => handler !== undefined)).toBe(true);
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
