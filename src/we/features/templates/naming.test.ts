import { describe, expect, it } from "vitest";

import { fieldSummaryLine } from "./naming";

describe("fieldSummaryLine", () => {
  it.each([
    [0, 0, "No fields"],
    [1, 0, "1 field"],
    [2, 0, "2 fields"],
    [1, 1, "1 field, 1 required"],
    [2, 1, "2 fields, 1 required"],
    [2, 2, "2 fields, 2 required"],
  ])("summarizes %i fields with %i required", (fieldCount, requiredCount, expected) => {
    expect(fieldSummaryLine(fieldCount, requiredCount)).toBe(expected);
  });
});
