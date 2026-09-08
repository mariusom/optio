import { describe, expect, it } from "vitest";

import { questionSummaryLine } from "./naming";

describe("questionSummaryLine", () => {
  it.each([
    [0, 0, "No questions yet"],
    [1, 0, "1 question"],
    [2, 0, "2 questions"],
    [1, 1, "1 question · 1 required"],
    [2, 1, "2 questions · 1 required"],
    [2, 2, "2 questions · 2 required"],
  ])("summarizes %i questions with %i required", (fieldCount, requiredCount, expected) => {
    expect(questionSummaryLine(fieldCount, requiredCount)).toBe(expected);
  });
});
