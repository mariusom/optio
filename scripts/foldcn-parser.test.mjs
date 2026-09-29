import { expect, test } from "vitest";
import { declarationStrings } from "./foldcn-parser.mjs";

test("extracts named class families without treating keys or dynamic layouts as classes", () => {
  const source = `
    export const fieldOrientationClasses = {
      vertical: "flex-col",
      "horizontal": "flex-row items-center",
    } as const;
    const fieldClass = "gap-2";
    const dynamicClass = \`group/field \${fieldClass}\`;
    const status = "not-a-class";
  `;
  expect([...declarationStrings(source, "fieldset.ts")]).toEqual([
    ["fieldOrientationClasses.vertical", "flex-col"],
    ["fieldOrientationClasses.horizontal", "flex-row items-center"],
    ["fieldClass", "gap-2"],
  ]);
});
