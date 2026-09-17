import { describe, expect, it } from "vitest";

import {
  formatBooleanDisplay,
  isBooleanTrue,
  parseJsonArray,
  toggleCheckboxOption,
} from "./fields";

const OPTIONS = { options: ["A", "B", "C", "D"], exclusiveOptions: [] };

describe("parseJsonArray (StringArrayCodec semantics)", () => {
  it("decodes valid arrays and degrades malformed values to []", () => {
    expect(parseJsonArray('["A","B"]')).toEqual(["A", "B"]);
    expect(parseJsonArray("[]")).toEqual([]);
    expect(parseJsonArray("not json")).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
});

describe("toggleCheckboxOption", () => {
  it("selects from empty", () => {
    expect(toggleCheckboxOption("", "A", OPTIONS)).toBe("A");
  });

  it("accumulates selections", () => {
    expect(toggleCheckboxOption("A", "B", OPTIONS)).toBe("A,B");
    expect(toggleCheckboxOption("A,B", "C", OPTIONS)).toBe("A,B,C");
  });

  it("deselects a middle item keeping the others", () => {
    expect(toggleCheckboxOption("A,B,C", "B", OPTIONS)).toBe("A,C");
  });

  it("output order always follows template option order regardless of tap order", () => {
    let value = "";
    for (const option of ["D", "C", "B", "A"]) value = toggleCheckboxOption(value, option, OPTIONS);
    expect(value).toBe("A,B,C,D");
  });
});

describe("exclusive options", () => {
  const OPTS = { options: ["Computer", "Phone", "None"], exclusiveOptions: ["None"] };

  it("selecting an exclusive wipes all other selections", () => {
    expect(toggleCheckboxOption("Computer,Phone", "None", OPTS)).toBe("None");
  });

  it("an exclusive can be selected from empty", () => {
    expect(toggleCheckboxOption("", "None", OPTS)).toBe("None");
  });

  it("selecting a normal option while an exclusive is held clears the exclusive", () => {
    expect(toggleCheckboxOption("None", "Computer", OPTS)).toBe("Computer");
  });

  it("re-tapping the selected exclusive deselects it", () => {
    expect(toggleCheckboxOption("None", "None", OPTS)).toBe("");
  });

  it("two exclusives replace each other; normal replaces either", () => {
    const OPTS2 = { options: ["A", "B", "None", "N/A"], exclusiveOptions: ["None", "N/A"] };
    expect(toggleCheckboxOption("A,B", "N/A", OPTS2)).toBe("N/A");
    expect(toggleCheckboxOption("N/A", "None", OPTS2)).toBe("None");
    expect(toggleCheckboxOption("None", "A", OPTS2)).toBe("A");
  });

  it("real-world checkbox scenario", () => {
    const REAL = {
      options: ["BNF", "Calculator", "Touchdose", "NONE"],
      exclusiveOptions: ["NONE"],
    };
    let value = "BNF,Calculator";
    value = toggleCheckboxOption(value, "NONE", REAL);
    expect(value).toBe("NONE");
    value = toggleCheckboxOption(value, "Touchdose", REAL);
    expect(value).toBe("Touchdose");
  });

  it("with no exclusives the group is a plain multi-select", () => {
    expect(toggleCheckboxOption("None,A", "B", { options: ["A", "B"], exclusiveOptions: [] })).toBe(
      "A,B",
    );
  });

  it("when every option is exclusive the group behaves like a radio", () => {
    const ALL = ["X", "Y"];
    expect(toggleCheckboxOption("X", "Y", { options: ALL, exclusiveOptions: ALL })).toBe("Y");
    expect(toggleCheckboxOption("Y", "X", { options: ALL, exclusiveOptions: ALL })).toBe("X");
  });
});

describe("boolean helpers", () => {
  it("isBooleanTrue recognizes case-insensitive true strings", () => {
    expect(isBooleanTrue("true")).toBe(true);
    expect(isBooleanTrue("True")).toBe(true);
    expect(isBooleanTrue(" TRUE ")).toBe(true);
    expect(isBooleanTrue("false")).toBe(false);
    expect(isBooleanTrue("False")).toBe(false);
    expect(isBooleanTrue("")).toBe(false);
    expect(isBooleanTrue("anything else")).toBe(false);
  });

  it("formatBooleanDisplay returns Yes for true and No for false or empty", () => {
    expect(formatBooleanDisplay("true")).toBe("Yes");
    expect(formatBooleanDisplay("True")).toBe("Yes");
    expect(formatBooleanDisplay("false")).toBe("No");
    expect(formatBooleanDisplay("")).toBe("No");
  });
});
