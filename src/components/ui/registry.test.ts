import { describe, expect, it } from "vitest";
import { inertHtml, type Html, type HtmlBuilder } from "foldkit/html";
import { input } from "./input";
import { textarea } from "./textarea";
import { checkbox } from "./checkbox";
import { switch_ } from "./switch";
import { nativeSelect } from "./native-select";
import { fieldset, fieldError } from "./fieldset";
import * as Dialog from "./dialog";
import * as AlertDialog from "./alert-dialog";
import * as Sheet from "./sheet";

const h = inertHtml as unknown as HtmlBuilder<string>;
type Node = NonNullable<Html>;
const nodes = (node: Html): Node[] =>
  node === null
    ? []
    : [
        node,
        ...(node.children ?? []).flatMap((child) =>
          typeof child === "object" ? nodes(child) : [],
        ),
      ];
const config = { id: "answer", label: "Answer", isChecked: false, onToggle: () => "toggle" };
const controls = {
  input: (description?: string) => input({ ...config, description }, h),
  textarea: (description?: string) => textarea({ ...config, description }, h),
  checkbox: (description?: string) => checkbox({ ...config, description }, h),
  switch: (description?: string) => switch_({ ...config, description }, h),
  select: (description?: string) => nativeSelect({ ...config, description, options: [] }, h),
  fieldset: (description?: string) =>
    fieldset({ ...config, description, legend: "Answers", children: [] }, h),
};

describe("Foldcn description contracts", () => {
  it.each(Object.entries(controls))("%s connects only rendered descriptions", (_, render) => {
    for (const description of [undefined, "Answer from direct observation."]) {
      const all = nodes(render(description));
      const described = all.filter((node) => node.data?.attrs?.["aria-describedby"]);
      expect(described).toHaveLength(description === undefined ? 0 : 1);
      if (description !== undefined) {
        const id = described[0]!.data!.attrs!["aria-describedby"];
        const target = all.find(
          (node) => node.data?.props?.id === id || node.data?.attrs?.id === id,
        );
        expect(target?.children).toContainEqual(expect.objectContaining({ text: description }));
      }
    }
  });

  it.each([Dialog, AlertDialog, Sheet])(
    "forwards the explicit dialog description flag",
    (component) => {
      for (const hasDescription of [undefined, false, true]) {
        expect(
          component.styledViewInputs({ hasDescription, content: () => [] }, h).hasDescription,
        ).toBe(hasDescription);
      }
    },
  );
});

it("omits empty field errors and deduplicates messages without dropping distinct errors", () => {
  expect(fieldError({ errors: [undefined, {}] }, h)).toBeNull();
  const all = nodes(
    fieldError(
      { errors: [{ message: "Required" }, { message: "Required" }, { message: "Invalid" }] },
      h,
    ),
  );
  expect(all.filter((node) => node.sel === "li").flatMap((node) => node.children ?? [])).toEqual([
    expect.objectContaining({ text: "Required" }),
    expect.objectContaining({ text: "Invalid" }),
  ]);
});
