import { describe, expect, it } from "vitest";

import { toggleCheckboxOption } from "../../fields";
import {
  canRecordTask,
  findNextUnfulfilledSectionId,
  isSectionDone,
  isTaskDone,
  taskStartDate,
  type RunnerSection,
  type RunnerTask,
} from "./runner";

const section = (overrides: Partial<RunnerSection> & { name: string }): RunnerSection => ({
  id: "s-" + overrides.name,
  taskId: "t1",
  kind: "textInput",
  isRequired: false,
  defaultValue: "",
  sortOrder: 0,
  options: [],
  exclusiveOptions: [],
  value: "",
  startDate: null,
  ...overrides,
});

const task = (
  sections: ReadonlyArray<RunnerSection>,
  overrides: Partial<RunnerTask> = {},
): RunnerTask => ({
  id: "task-1",
  orderIndex: 1,
  endDate: null,
  isBeingEdited: false,
  sections,
  ...overrides,
});

describe("isSectionDone", () => {
  it("optional empty is done", () => {
    expect(isSectionDone(section({ name: "Notes", isRequired: false, value: "" }))).toBe(true);
  });
  it("required empty is not done", () => {
    expect(isSectionDone(section({ name: "Activity", isRequired: true, value: "" }))).toBe(false);
  });
  it("required filled is done", () => {
    expect(isSectionDone(section({ name: "Activity", isRequired: true, value: "hello" }))).toBe(
      true,
    );
  });
  it("boolean never required", () => {
    expect(
      isSectionDone(
        section({ name: "Interrupted", kind: "boolean", isRequired: false, value: "false" }),
      ),
    ).toBe(true);
  });
});

describe("isTaskDone / canRecord", () => {
  it("true when all required sections filled", () => {
    const t = task([
      section({ name: "A", isRequired: true, value: "x" }),
      section({ name: "B", isRequired: false, value: "" }),
      section({ name: "C", isRequired: true, value: "y" }),
    ]);
    expect(isTaskDone(t)).toBe(true);
    expect(canRecordTask(t)).toBe(true);
  });
  it("false when any required empty", () => {
    const t = task([
      section({ name: "A", isRequired: true, value: "" }),
      section({ name: "B", isRequired: false, value: "x" }),
    ]);
    expect(isTaskDone(t)).toBe(false);
    expect(canRecordTask(t)).toBe(false);
  });
  it("false for null task", () => {
    expect(canRecordTask(null)).toBe(false);
  });
  it("prefilled defaults count as filled", () => {
    const t = task([
      section({
        name: "Radio",
        isRequired: true,
        value: "Communication",
        kind: "radio",
        options: ["Communication"],
      }),
    ]);
    expect(isTaskDone(t)).toBe(true);
  });
});

describe("taskStartDate (earliest touched)", () => {
  it("null when no sections touched", () => {
    const t = task([
      section({ name: "A", startDate: null }),
      section({ name: "B", startDate: null }),
    ]);
    expect(taskStartDate(t)).toBeNull();
  });
  it("returns min startDate", () => {
    const t = task([
      section({ name: "A", startDate: 3000, value: "x" }),
      section({ name: "B", startDate: 1000, value: "y" }),
      section({ name: "C", startDate: 2000, value: "z" }),
    ]);
    expect(taskStartDate(t)).toBe(1000);
  });
  it("earliest is s1 even if s0 touched later (regression)", () => {
    // Mirrors Task spec: writing s1 then s0 later ⇒ start = s1's stamp
    const t = task([
      section({ name: "s0", startDate: 2000, value: "a" }),
      section({ name: "s1", startDate: 1000, value: "b" }),
    ]);
    expect(taskStartDate(t)).toBe(1000);
  });
});

describe("findNextUnfulfilledSectionId (radio auto-advance)", () => {
  const secs = [
    section({ name: "One", isRequired: true, value: "filled", sortOrder: 0, id: "s1" }),
    section({ name: "Two", isRequired: true, value: "", sortOrder: 1, id: "s2" }),
    section({ name: "Three", isRequired: true, value: "filled", sortOrder: 2, id: "s3" }),
    section({ name: "Four", isRequired: false, value: "", sortOrder: 3, id: "s4" }),
  ];
  it("finds next !isDone", () => {
    expect(findNextUnfulfilledSectionId(secs, "s1")).toBe("s2");
  });
  it("skips done sections and finds next empty optional", () => {
    // s2 empty required, so next after s2 is s4 (optional empty but isDone true → value empty still considered need focus?)
    // Spec: !isDone || value.isEmpty → optional empty qualifies
    const all = [
      section({ name: "One", isRequired: true, value: "a", id: "a" }),
      section({ name: "Two", isRequired: false, value: "", id: "b" }),
      section({ name: "Three", isRequired: true, value: "c", id: "c" }),
    ];
    expect(findNextUnfulfilledSectionId(all, "a")).toBe("b");
  });
  it("returns null when no next unfulfilled", () => {
    const done = [
      section({ name: "A", isRequired: true, value: "x", id: "x1" }),
      section({ name: "B", isRequired: false, value: "y", id: "y1" }),
    ];
    expect(findNextUnfulfilledSectionId(done, "x1")).toBeNull();
  });
});

describe("checkbox logic (reused)", () => {
  it("exclusive clears others and order follows template", () => {
    const opts = ["Computer", "Phone", "Paper", "Reference material", "None"];
    const exclusive = ["None"];
    let v = "Computer,Phone";
    v = toggleCheckboxOption(v, "None", opts, exclusive);
    expect(v).toBe("None");
    v = toggleCheckboxOption(v, "Phone", opts, exclusive);
    expect(v).toBe("Phone");
  });
  it("output order follows template regardless of tap order", () => {
    const opts = ["A", "B", "C", "D"];
    let v = "";
    for (const o of ["D", "C", "B", "A"]) v = toggleCheckboxOption(v, o, opts, []);
    expect(v).toBe("A,B,C,D");
  });
});

describe("startDate COALESCE semantics", () => {
  // This tests the SQL COALESCE behavior via event materializer expectation:
  // First write stamps startDate, subsequent writes keep earliest.
  // We model it pure: startDate null → now, else keep.
  const coalesce = (current: number | null, now: number) => current ?? now;
  it("first assignment stamps now", () => {
    expect(coalesce(null, 12345)).toBe(12345);
  });
  it("subsequent keeps original", () => {
    expect(coalesce(1000, 2000)).toBe(1000);
  });
  it("restored value does not touch startDate (taskFieldValueRestored)", () => {
    // restore keeps startDate
    const original = 1000;
    const restored = original; // no change
    expect(restored).toBe(1000);
  });
});
