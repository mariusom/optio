import { describe, expect, it } from "vitest";

import {
  formatBooleanDisplay,
  isBooleanTrue,
  isScalarAnswerValid,
  parseJsonArray,
  toggleCheckboxOption,
} from "./fields";

const OPTIONS = ["A", "B", "C", "D"];

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
    expect(toggleCheckboxOption("", "A", OPTIONS, [])).toBe("A");
  });

  it("accumulates selections", () => {
    expect(toggleCheckboxOption("A", "B", OPTIONS, [])).toBe("A,B");
    expect(toggleCheckboxOption("A,B", "C", OPTIONS, [])).toBe("A,B,C");
  });

  it("deselects a middle item keeping the others", () => {
    expect(toggleCheckboxOption("A,B,C", "B", OPTIONS, [])).toBe("A,C");
  });

  it("output order always follows template option order regardless of tap order", () => {
    let value = "";
    for (const option of ["D", "C", "B", "A"])
      value = toggleCheckboxOption(value, option, OPTIONS, []);
    expect(value).toBe("A,B,C,D");
  });
});

describe("exclusive options", () => {
  const EXCLUSIVE = ["None"];
  const OPTS = ["Computer", "Phone", "None"];

  it("selecting an exclusive wipes all other selections", () => {
    expect(toggleCheckboxOption("Computer,Phone", "None", OPTS, EXCLUSIVE)).toBe("None");
  });

  it("an exclusive can be selected from empty", () => {
    expect(toggleCheckboxOption("", "None", OPTS, EXCLUSIVE)).toBe("None");
  });

  it("selecting a normal option while an exclusive is held clears the exclusive", () => {
    expect(toggleCheckboxOption("None", "Computer", OPTS, EXCLUSIVE)).toBe("Computer");
  });

  it("re-tapping the selected exclusive deselects it", () => {
    expect(toggleCheckboxOption("None", "None", OPTS, EXCLUSIVE)).toBe("");
  });

  it("two exclusives replace each other; normal replaces either", () => {
    const TWO = ["None", "N/A"];
    const OPTS2 = ["A", "B", "None", "N/A"];
    expect(toggleCheckboxOption("A,B", "N/A", OPTS2, TWO)).toBe("N/A");
    expect(toggleCheckboxOption("N/A", "None", OPTS2, TWO)).toBe("None");
    expect(toggleCheckboxOption("None", "A", OPTS2, TWO)).toBe("A");
  });

  it("real-world checkbox scenario", () => {
    const REAL = ["BNF", "Calculator", "Touchdose", "NONE"];
    let value = "BNF,Calculator";
    value = toggleCheckboxOption(value, "NONE", REAL, ["NONE"]);
    expect(value).toBe("NONE");
    value = toggleCheckboxOption(value, "Touchdose", REAL, ["NONE"]);
    expect(value).toBe("Touchdose");
  });

  it("with no exclusives the group is a plain multi-select", () => {
    expect(toggleCheckboxOption("None,A", "B", ["A", "B"], [])).toBe("A,B");
  });

  it("when every option is exclusive the group behaves like a radio", () => {
    const ALL = ["X", "Y"];
    expect(toggleCheckboxOption("X", "Y", ALL, ALL)).toBe("Y");
    expect(toggleCheckboxOption("Y", "X", ALL, ALL)).toBe("X");
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

  it("formatBooleanDisplay distinguishes unanswered from No", () => {
    expect(formatBooleanDisplay("true")).toBe("Yes");
    expect(formatBooleanDisplay("True")).toBe("Yes");
    expect(formatBooleanDisplay("false")).toBe("No");
    expect(formatBooleanDisplay("")).toBe("Unanswered");
  });
});

describe("scalar answers", () => {
  it.each([
    ["number", "-12.75", true],
    ["number", ".5", true],
    ["number", "0", true],
    ["number", "12kg", false],
    ["number", "Infinity", false],
    ["number", " ", false],
    ["number", "-", false],
    ["number", "1,5", false],
    ["counter", "0", true],
    ["counter", "17", true],
    ["counter", "-1", false],
    ["counter", "1.5", false],
    ["counter", "9007199254740992", false],
    ["rating", "1", true],
    ["rating", "5", true],
    ["rating", "0", false],
    ["rating", "6", false],
    ["rating", "2.5", false],
    ["boolean", "false", true],
    ["boolean", "maybe", false],
  ])("validates %s value %j", (kind, value, valid) => {
    expect(isScalarAnswerValid(kind as string, value as string)).toBe(valid);
  });
  it.each(["number", "counter", "rating", "boolean"])("allows unanswered %s", (kind) => {
    expect(isScalarAnswerValid(kind, "")).toBe(true);
  });
});
