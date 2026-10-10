import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import { vi } from "vitest";

import { init, update, type Model } from "../../../main";
import { Message } from "../../../messages";
import { planSession } from "../../../machine/session/sessionMachine";
import { repeatPlan } from "./repeatAnswers";
import type { RunnerSection, RunnerState, RunnerTask } from "./runner";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

const section = (
  taskId: string,
  name: string,
  overrides: Partial<RunnerSection> = {},
): RunnerSection => ({
  id: `${taskId}-${name}`,
  taskId,
  name,
  kind: "textInput",
  isRequired: true,
  defaultValue: "",
  sortOrder: 0,
  options: [],
  exclusiveOptions: [],
  value: "",
  startDate: null,
  ...overrides,
});

/** Activity (radio), Station (text), Count (counter, default 0), Notes (optional). */
const questions = (taskId: string, values: Readonly<Record<string, string>> = {}) => {
  const answered = (name: string) => (values[name] === undefined ? null : 1_000);
  return [
    section(taskId, "Activity", {
      kind: "radio",
      options: ["Observe", "Assist"],
      value: values.Activity ?? "",
      startDate: answered("Activity"),
    }),
    section(taskId, "Station", {
      sortOrder: 1,
      value: values.Station ?? "",
      startDate: answered("Station"),
    }),
    section(taskId, "Count", {
      kind: "counter",
      sortOrder: 2,
      defaultValue: "0",
      value: values.Count ?? "0",
      startDate: answered("Count"),
    }),
    section(taskId, "Notes", {
      kind: "textArea",
      sortOrder: 3,
      isRequired: false,
      value: values.Notes ?? "",
      startDate: answered("Notes"),
    }),
  ];
};

const task = (id: string, orderIndex: number, overrides: Partial<RunnerTask> = {}): RunnerTask => ({
  id,
  orderIndex,
  endDate: null,
  isBeingEdited: false,
  sections: questions(id),
  ...overrides,
});

const recorded = (id: string, orderIndex: number, values: Readonly<Record<string, string>>) =>
  task(id, orderIndex, { endDate: 5_000 + orderIndex, sections: questions(id, values) });

const runnerWith = (tasks: ReadonlyArray<RunnerTask>, currentTaskId: string): RunnerState => ({
  sessionId: "s1",
  templateName: "Line study",
  sessionName: "Line 4",
  startedAt: 0,
  now: 9_000,
  currentTaskId,
  completedCount: tasks.filter((t) => t.endDate !== null).length,
  focusedSectionId: null,
  showTaskList: false,
  showEndConfirm: false,
  showSidebar: true,
  lastError: null,
  fieldWrites: { revision: 0, pending: [] },
  announcement: null,
  tasks,
});

const twoDone = {
  first: recorded("t1", 1, { Activity: "Observe", Station: "A", Count: "4", Notes: "old" }),
  second: recorded("t2", 2, { Activity: "Assist", Station: "B", Count: "7" }),
};

const plan = (runner: RunnerState) =>
  planSession({ runner, now: runner.now }, { _tag: "RepeatRequested" });

describe("repeat last answers plan", () => {
  it("copies the newest recorded task into unanswered questions only", () => {
    const open = task("t3", 3, { sections: questions("t3", { Station: "C" }) });
    const runner = runnerWith([twoDone.first, open, twoDone.second], "t3");
    const result = repeatPlan(runner)!;
    expect(result.source?.id).toBe("t2");
    // Station was answered ("C") and stays; Notes was empty on task 2.
    expect(result.writes).toEqual([
      { taskFieldId: "t3-Activity", value: "Assist" },
      { taskFieldId: "t3-Count", value: "7" },
    ]);
  });

  it("has no source for the first task and nothing to fill once answered", () => {
    expect(repeatPlan(runnerWith([task("t1", 1)], "t1"))).toEqual(
      expect.objectContaining({ source: null, writes: [] }),
    );
    const filled = task("t3", 3, {
      sections: questions("t3", { Activity: "Observe", Station: "C", Count: "1" }),
    });
    expect(repeatPlan(runnerWith([twoDone.second, filled], "t3"))!.writes).toEqual([]);
  });

  it("skips choices the open task no longer offers", () => {
    const open = task("t3", 3, {
      sections: questions("t3").map((s) => (s.kind === "radio" ? { ...s, options: ["X"] } : s)),
    });
    const writes = repeatPlan(runnerWith([twoDone.second, open], "t3"))!.writes;
    expect(writes.map((write) => write.taskFieldId)).toEqual(["t3-Station", "t3-Count"]);
  });

  it("does not apply to a completed task being edited", () => {
    const editing = { ...twoDone.second, isBeingEdited: true };
    expect(repeatPlan(runnerWith([twoDone.first, editing], "t2"))).toBeNull();
  });
});

describe("RepeatRequested through the session planner", () => {
  it("fills in one batch, stamps first-write times and announces the result", () => {
    const runner = runnerWith([twoDone.second, task("t3", 3)], "t3");
    const result = plan(runner);
    expect(result.emissions).toEqual([
      {
        _tag: "CommitFieldValues",
        writes: [
          { taskFieldId: "t3-Activity", value: "Assist" },
          { taskFieldId: "t3-Station", value: "B" },
          { taskFieldId: "t3-Count", value: "7" },
        ],
      },
    ]);
    const open = result.runner!.tasks.find((t) => t.id === "t3")!;
    expect(open.sections.map((s) => [s.value, s.startDate])).toEqual([
      ["Assist", 9_000],
      ["B", 9_000],
      ["7", 9_000],
      ["", null],
    ]);
    // Dispatched writes stay in the overlay until the store echoes them.
    expect(result.runner!.fieldWrites.pending).toEqual([
      { taskFieldId: "t3-Activity", value: "Assist", committed: true },
      { taskFieldId: "t3-Station", value: "B", committed: true },
      { taskFieldId: "t3-Count", value: "7", committed: true },
    ]);
    expect(result.runner!.announcement).toEqual({
      kind: "filled",
      text: "Filled 3 answers from task 2",
    });
    // A second request has nothing left to fill.
    expect(plan(result.runner!).emissions).toEqual([]);
  });

  it("is a no-op without a previous task", () => {
    const runner = runnerWith([task("t1", 1)], "t1");
    const result = plan(runner);
    expect(result.runner).toBe(runner);
    expect(result.emissions).toEqual([]);
  });

  it("writes pending typed answers first, then the copies", () => {
    const open = task("t3", 3, { sections: questions("t3", { Notes: "typing" }) });
    const runner: RunnerState = {
      ...runnerWith([twoDone.second, open], "t3"),
      fieldWrites: {
        revision: 4,
        pending: [{ taskFieldId: "t3-Notes", value: "typing more", committed: false }],
      },
    };
    const tags = plan(runner).emissions.map((emission) =>
      emission._tag === "CommitFieldValues" ? emission.writes.map((w) => w.taskFieldId) : [],
    );
    expect(tags).toEqual([["t3-Notes"], ["t3-Activity", "t3-Station", "t3-Count"]]);
  });
});

describe("recording confirmation", () => {
  it("announces the recorded task and asks for device feedback", () => {
    const runner = runnerWith([recorded("t1", 1, { Station: "A" }), task("t2", 2)], "t2");
    const result = planSession({ runner, now: runner.now }, { _tag: "RecordAcked", taskId: "t1" });
    expect(result.runner!.announcement).toEqual({ kind: "recorded", text: "Task 1 recorded" });
    expect(result.emissions).toEqual([{ _tag: "ConfirmRecorded" }]);
  });

  it("clears the confirmation on the next answer", () => {
    const runner: RunnerState = {
      ...runnerWith([task("t1", 1)], "t1"),
      announcement: { kind: "recorded", text: "Task 1 recorded" },
    };
    const result = planSession(
      { runner, now: runner.now },
      { _tag: "FieldChanged", taskFieldId: "t1-Activity", value: "Observe" },
    );
    expect(result.runner!.announcement).toBeNull();
    // Unrelated events keep it.
    const synced = planSession(
      { runner, now: runner.now },
      { _tag: "SectionFocused", fieldId: null },
    );
    expect(synced.runner!.announcement).not.toBeNull();
  });
});

const onRunner = (runner: RunnerState): Model => ({
  ...init(Option.getOrThrow(fromString("https://optio.test/#/session/s1"))).model,
  runner,
});

describe("repeat and record feedback through the update loop", () => {
  it("dispatches one UpdateFieldValues batch for Repeat last answers", () => {
    const model = onRunner(runnerWith([twoDone.second, task("t3", 3)], "t3"));
    const result = update(model, Message.ClickedRepeatLastAnswers());
    expect(result.commands).toEqual([
      expect.objectContaining({
        name: "UpdateFieldValues",
        args: {
          writes: [
            { taskFieldId: "t3-Activity", value: "Assist" },
            { taskFieldId: "t3-Station", value: "B" },
            { taskFieldId: "t3-Count", value: "7" },
          ],
        },
      }),
    ]);
  });

  it("vibrates through a command after a task is recorded", () => {
    const model = onRunner(runnerWith([recorded("t1", 1, {}), task("t2", 2)], "t2"));
    const result = update(model, Message.TaskRecorded({ taskId: "t1" }));
    expect((result.commands ?? []).map((command) => command.name)).toEqual(["VibrateRecorded"]);
  });
});
