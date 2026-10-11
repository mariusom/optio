import { describe, expect, it } from "vitest";

import { formatShare, timeBreakdown, wholePercents } from "./timeBreakdown";

const section = (sectionName: string, sectionType: string, value: string) => ({
  sectionName,
  sectionType,
  value,
});

const task = (
  durationMs: number,
  sections: ReadonlyArray<ReturnType<typeof section>>,
  startedAt: number | null = 0,
) => ({ startedAt, endedAt: startedAt === null ? null : startedAt + durationMs, sections });

const summary = (tasks: Parameters<typeof timeBreakdown>[0]) =>
  timeBreakdown(tasks).map((question) => ({
    question: question.question,
    totalMs: question.totalMs,
    segments: question.segments.map(({ label, kind, durationMs, share, slot }) => ({
      label,
      kind,
      durationMs,
      share,
      slot,
    })),
  }));

describe("timeBreakdown", () => {
  it("totals task time per answer, most time first, with unanswered last", () => {
    expect(
      summary([
        task(1_000, [section("Activity", "radio", "Walk")]),
        task(6_000, [section("Activity", "radio", "Wait")]),
        task(2_000, [section("Activity", "radio", "Walk")]),
        task(2_000, [section("Activity", "radio", "")]),
      ]),
    ).toEqual([
      {
        question: "Activity",
        totalMs: 11_000,
        segments: [
          { label: "Wait", kind: "answer", durationMs: 6_000, share: 6 / 11, slot: 0 },
          { label: "Walk", kind: "answer", durationMs: 3_000, share: 3 / 11, slot: 1 },
          { label: "Unanswered", kind: "unanswered", durationMs: 2_000, share: 2 / 11, slot: null },
        ],
      },
    ]);
  });

  it("names yes/no answers and keeps Yes first", () => {
    const [question] = summary([
      task(5_000, [section("Value added", "boolean", "false")]),
      task(1_000, [section("Value added", "boolean", "true")]),
    ]);
    expect(question?.segments.map((segment) => [segment.label, segment.durationMs])).toEqual([
      ["Yes", 1_000],
      ["No", 5_000],
    ]);
  });

  it("only covers single-choice and yes/no questions answered at least once", () => {
    expect(
      summary([
        task(1_000, [
          section("Notes", "textInput", "hello"),
          section("Tags", "checkbox", "A,B"),
          section("Never answered", "radio", ""),
          section("Count", "counter", "3"),
        ]),
      ]),
    ).toEqual([]);
  });

  it("leaves out tasks without both a start and an end", () => {
    expect(
      summary([
        task(1_000, [section("Activity", "radio", "Walk")], null),
        { startedAt: 0, endedAt: null, sections: [section("Activity", "radio", "Walk")] },
      ]),
    ).toEqual([]);
  });

  it("skips questions whose tasks took no time", () => {
    expect(summary([task(0, [section("Activity", "radio", "Walk")])])).toEqual([]);
  });

  it("keeps the top five answers and folds the rest into Other", () => {
    const answers = ["A", "B", "C", "D", "E", "F", "G"];
    const [question] = summary(
      answers.map((answer, index) =>
        task((answers.length - index) * 1_000, [section("Step", "radio", answer)]),
      ),
    );
    expect(question?.segments.map((segment) => [segment.label, segment.slot])).toEqual([
      ["A", 0],
      ["B", 1],
      ["C", 2],
      ["D", 3],
      ["E", 4],
      ["Other", 5],
    ]);
    expect(question?.segments.at(-1)?.durationMs).toBe(3_000);
  });

  it("shows a sixth answer by name instead of an Other holding one answer", () => {
    const answers = ["A", "B", "C", "D", "E", "F"];
    const [question] = summary(
      answers.map((answer) => task(1_000, [section("Step", "radio", answer)])),
    );
    expect(question?.segments.map((segment) => segment.label)).toEqual(answers);
  });

  it("keeps questions sharing a name apart, in question order", () => {
    const breakdown = timeBreakdown([
      task(1_000, [section("Place", "radio", "In"), section("Place", "radio", "Out")]),
    ]);
    expect(breakdown.map((question) => [question.key, question.segments[0]?.label])).toEqual([
      ["Place#0", "In"],
      ["Place#1", "Out"],
    ]);
  });
});

describe("formatShare", () => {
  it("shows whole percentages without hiding slivers", () => {
    expect(formatShare({ share: 0.456, percent: 46 })).toBe("46%");
    expect(formatShare({ share: 1, percent: 100 })).toBe("100%");
    expect(formatShare({ share: 0.001, percent: 0 })).toBe("<1%");
    expect(formatShare({ share: 0, percent: 0 })).toBe("0%");
  });
});

describe("wholePercents", () => {
  it("always totals 100 using the largest remainders", () => {
    // Plain rounding gives 33 + 33 + 33 = 99 for thirds and 63 + 21 + 17 = 101
    // for 62.5/21.25/16.25.
    expect(wholePercents([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33]);
    expect(wholePercents([0.625, 0.2125, 0.1625])).toEqual([63, 21, 16]);
    expect(wholePercents([0.994, 0.006])).toEqual([99, 1]);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
  });

  it("keeps every question's segments at 100% in a breakdown", () => {
    const tasks = [4_000, 1_300, 1_100].map((ms, index) => ({
      startedAt: 0,
      endedAt: ms,
      sections: [{ sectionName: "Type", value: ["A", "B", "C"][index]!, sectionType: "radio" }],
    }));
    const [question] = timeBreakdown(tasks);
    expect(question!.segments.reduce((sum, segment) => sum + segment.percent, 0)).toBe(100);
  });
});
