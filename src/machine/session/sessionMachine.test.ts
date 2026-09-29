import { describe, expect, it } from "@effect/vitest";

import {
  nextFocusForField,
  planSession,
  sessionPhase,
  type RunnerData,
  type RunnerState,
  type SessionEvent,
} from "./sessionMachine";

// ── Fixtures ────────────────────────────────────────────────────────────────

const section = (
  id: string,
  name: string,
  kind: string,
  isRequired: boolean,
  value = "",
  sortOrder = 0,
) => ({
  id,
  taskId: "task-1",
  name,
  kind,
  isRequired,
  defaultValue: "",
  sortOrder,
  options: kind === "radio" ? ["A", "B"] : [],
  exclusiveOptions: [],
  value,
  startDate: null,
});

const data = (overrides: Partial<RunnerData> = {}): RunnerData => ({
  sessionId: "sess-1",
  templateName: "Sample Study",
  sessionName: "",
  startedAt: 1_700_000_000_000,
  tasks: [
    {
      id: "task-1",
      orderIndex: 0,
      endDate: null,
      isBeingEdited: false,
      sections: [
        section("f-activity", "Activity", "textInput", true, "Typing", 0),
        section("f-category", "Category", "radio", true, "", 1),
      ],
    },
    {
      id: "task-2",
      orderIndex: 1,
      endDate: 1_700_000_000_500,
      isBeingEdited: false,
      sections: [section("f-note", "Notes", "textArea", false, "Old note", 0)],
    },
  ],
  currentTaskId: "task-1",
  completedCount: 0,
  ...overrides,
});

const liveRunner = (overrides: Partial<RunnerState> = {}) => ({
  ...data(),
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: true,
  lastError: null,
  now: 1_700_000_001_000,
  showEndConfirm: false,
  fieldWrites: { revision: 0, pending: [] },
  ...overrides,
});

// ── Helper: plan via the bridge, asserting no error ─────────────────────────

const plan = (runner: ReturnType<typeof liveRunner> | null, event: SessionEvent) => {
  const result = planSession({ runner, now: runner?.now ?? 0 }, event);
  return { ...result, phase: sessionPhase(result.runner) };
};
type Planned = ReturnType<typeof plan>;

/** Plans from a previous result, carrying its runner and ticked time forward. */
const planFrom = (previous: Planned, event: SessionEvent) => plan(previous.runner, event);

// ── Tests ───────────────────────────────────────────────────────────────────

describe("sessionMachine topology", () => {
  it("dispatches counter adjustments through the planner", () => {
    const runner = liveRunner();
    runner.tasks = [
      { ...runner.tasks[0], sections: [section("count", "Count", "counter", false, "7")] },
    ];
    expect(
      plan(runner, { _tag: "CounterAdjusted", taskFieldId: "count", delta: 1 }).emissions,
    ).toEqual([{ _tag: "CommitCounterAdjustment", taskFieldId: "count", delta: 1 }]);
  });

  it("retains an invalid completed edit when another task is selected", () => {
    const runner = liveRunner();
    runner.tasks = [
      runner.tasks[0],
      {
        ...runner.tasks[1],
        isBeingEdited: true,
        sections: [section("count", "Count", "counter", false, "-1")],
      },
    ];
    runner.currentTaskId = "task-2";
    const result = plan(runner, { _tag: "TaskSelected", taskId: "task-1" });
    expect(result.emissions).toEqual([]);
    expect(result.runner?.currentTaskId).toBe("task-2");
    expect(result.runner?.lastError).toMatch(/correct invalid answers/);
  });

  it("stays Idle for events other than live data", () => {
    for (const event of [
      { _tag: "RecordRequested" },
      { _tag: "EndConfirmed" },
      { _tag: "TaskListToggled" },
    ] as const) {
      expect(plan(null, event)).toEqual({ runner: null, phase: "collecting", emissions: [] });
    }
  });

  it("returns the same runner reference for events that don't apply", () => {
    const runner = liveRunner();
    expect(plan(runner, { _tag: "EndCancelled" }).runner).toBe(runner);
    expect(plan(runner, { _tag: "EditSaved" }).runner).toBe(runner);
    expect(plan(runner, { _tag: "SectionFocused", fieldId: null }).runner).toBe(runner);
  });

  it("ignores field and counter changes for completed tasks outside edit mode", () => {
    const runner = liveRunner();
    runner.tasks = [
      runner.tasks[0],
      { ...runner.tasks[1], sections: [section("count", "Count", "counter", false, "1")] },
    ];
    const changed = plan(runner, { _tag: "FieldChanged", taskFieldId: "count", value: "4" });
    expect(changed.emissions).toEqual([]);
    expect(changed.runner).toBe(runner);
    const adjusted = plan(runner, { _tag: "CounterAdjusted", taskFieldId: "count", delta: 1 });
    expect(adjusted.emissions).toEqual([]);
  });

  it("clears a stale error once recording succeeds", () => {
    const failed = plan(liveRunner(), { _tag: "RecordRequested" });
    expect(failed.runner?.lastError).toMatch(/required questions/);
    const answered = plan(failed.runner, {
      _tag: "DataSynced",
      data: data({
        tasks: [
          {
            ...data().tasks[0]!,
            sections: [
              section("f-activity", "Activity", "textInput", true, "Typing", 0),
              section("f-category", "Category", "radio", true, "A", 1),
            ],
          },
          data().tasks[1]!,
        ],
      }),
    });
    const recorded = planFrom(answered, { _tag: "RecordRequested" });
    expect(recorded.emissions).toEqual([
      { _tag: "CommitRecord", sessionId: "sess-1", taskId: "task-1" },
    ]);
    expect(recorded.runner?.lastError).toBeNull();
    const withError = { ...recorded.runner!, lastError: "write failed" };
    expect(plan(withError, { _tag: "RecordAcked" }).runner?.lastError).toBeNull();
    expect(plan(withError, { _tag: "EditAcked" }).runner?.lastError).toBeNull();
  });

  it("enters Live.Collecting with fresh controls on first DataSynced", () => {
    const { runner, phase } = plan(null, { _tag: "DataSynced", data: data() });
    expect(phase).toBe("collecting");
    expect(runner).not.toBeNull();
    expect(runner!.focusedSectionId).toBeNull();
    expect(runner!.showSidebar).toBe(true);
    expect(runner!.showEndConfirm).toBe(false);
  });

  it("returns to Idle when DataSynced null", () => {
    const { runner } = plan(liveRunner(), { _tag: "DataSynced", data: null });
    expect(runner).toBeNull();
  });

  it("stays Idle without failing when DataSynced null arrives at Idle (dead runner link)", () => {
    // Regression: the Idle handler used to plan an entry into the compound
    // Live state without an active child — invalid configuration, so every
    // store refresh errored ("Machine expected state Live builder to provide
    // active child states") while the runner route showed an infinite
    // "Loading session…". Must be a safe no-op.
    const planned = plan(null, { _tag: "DataSynced", data: null });
    expect(planned.runner).toBeNull();
    expect(planned.emissions).toEqual([]);
  });

  it("preserves controls across same-session DataSynced", () => {
    const start = plan(
      liveRunner({ focusedSectionId: "f-category", showTaskList: true, lastError: "oops" }),
      { _tag: "DataSynced", data: data() },
    );
    expect(start.runner!.focusedSectionId).toBe("f-category");
    expect(start.runner!.showTaskList).toBe(true);
    expect(start.runner!.lastError).toBe("oops");
  });

  it("resets controls on a different session (new session started)", () => {
    const start = plan(liveRunner({ focusedSectionId: "f-category", showTaskList: true }), {
      _tag: "DataSynced",
      data: data({ sessionId: "sess-2" }),
    });
    expect(start.runner!.sessionId).toBe("sess-2");
    expect(start.runner!.focusedSectionId).toBeNull();
    expect(start.runner!.showTaskList).toBe(false);
  });
});

describe("sessionMachine recording", () => {
  it("commits a first answer at once and keeps focus for non-radio fields", () => {
    const { runner, emissions } = plan(liveRunner(), {
      _tag: "FieldChanged",
      taskFieldId: "f-activity",
      value: "More typing",
    });
    expect(emissions).toEqual([
      { _tag: "CommitFieldValues", writes: [{ taskFieldId: "f-activity", value: "More typing" }] },
    ]);
    expect(runner!.focusedSectionId).toBeNull();
  });

  it("auto-advances focus on a completing radio", () => {
    const { runner } = plan(liveRunner({ focusedSectionId: "f-category" }), {
      _tag: "FieldChanged",
      taskFieldId: "f-category",
      value: "B",
    });
    // Category is the last unfulfilled radio → advance clears focus
    expect(runner!.focusedSectionId).toBeNull();
  });

  it("gates RecordRequested on required fields with lastError", () => {
    const { runner, emissions } = plan(liveRunner(), { _tag: "RecordRequested" });
    expect(emissions).toEqual([]);
    expect(runner!.lastError).toBe("Answer the required questions before recording.");
  });

  it("commits a record when the current task is complete", () => {
    const done = data({
      tasks: [
        {
          id: "task-1",
          orderIndex: 0,
          endDate: null,
          isBeingEdited: false,
          sections: [
            section("f-activity", "Activity", "textInput", true, "Typing", 0),
            section("f-category", "Category", "radio", true, "A", 1),
          ],
        },
      ],
    });
    const { runner, emissions } = plan(liveRunner({ ...done, focusedSectionId: "f-category" }), {
      _tag: "RecordRequested",
    });
    expect(emissions).toEqual([{ _tag: "CommitRecord", sessionId: "sess-1", taskId: "task-1" }]);
    expect(runner!.focusedSectionId).toBeNull();
  });

  it("ignores RecordRequested for an editing task before required-field validation", () => {
    const editing = data({
      tasks: [
        {
          id: "task-1",
          orderIndex: 0,
          endDate: null,
          isBeingEdited: true,
          sections: [section("f-required", "Required", "textInput", true, "", 0)],
        },
      ],
    });
    const { runner, emissions } = plan(liveRunner({ ...editing, lastError: null }), {
      _tag: "RecordRequested",
    });
    expect(emissions).toEqual([]);
    expect(runner!.lastError).toBeNull();
  });

  it("ignores a completed task selected immediately before RecordRequested", () => {
    const selected = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-2" });
    const recorded = plan(selected.runner, { _tag: "RecordRequested" });
    expect(recorded.emissions).toEqual([]);
    expect(recorded.runner!.lastError).toBeNull();
  });

  it("RecordAcked clears focus and task list", () => {
    const { runner } = plan(liveRunner({ focusedSectionId: "f-activity", showTaskList: true }), {
      _tag: "RecordAcked",
    });
    expect(runner!.focusedSectionId).toBeNull();
    expect(runner!.showTaskList).toBe(false);
  });
});

describe("sessionMachine task selection + edit", () => {
  it("selecting a finished task requests persisted edit mode", () => {
    const { runner, emissions } = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-2" });
    expect(emissions).toEqual([
      { _tag: "CommitSelectTask", sessionId: "sess-1", taskId: "task-2" },
    ]);
    expect(runner!.currentTaskId).toBe("task-2");
  });

  it("select → sync → change → sync → reselect → cancel requests rollback of the edited task", () => {
    const selected = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-2" });
    const editing = data({
      currentTaskId: "task-2",
      tasks: data().tasks.map((task) => ({
        ...task,
        isBeingEdited: task.id === "task-2",
      })),
    });
    const synced = plan(selected.runner, { _tag: "DataSynced", data: editing });
    const changed = plan(synced.runner, {
      _tag: "FieldChanged",
      taskFieldId: "f-note",
      value: "Changed",
    });
    expect(changed.emissions).toEqual([
      { _tag: "CommitFieldValues", writes: [{ taskFieldId: "f-note", value: "Changed" }] },
    ]);
    const changedData = {
      ...editing,
      tasks: editing.tasks.map((task) => ({
        ...task,
        sections: task.sections.map((field) =>
          field.id === "f-note" ? { ...field, value: "Changed" } : field,
        ),
      })),
    };
    const refreshed = plan(changed.runner, { _tag: "DataSynced", data: changedData });
    const reselected = plan(refreshed.runner, { _tag: "TaskSelected", taskId: "task-2" });
    const resynced = plan(reselected.runner, { _tag: "DataSynced", data: changedData });
    const cancelled = plan(resynced.runner, { _tag: "EditCancelled" });
    expect(cancelled.emissions).toEqual([{ _tag: "CommitCancelEdit", taskId: "task-2" }]);
    const restored = plan(cancelled.runner, {
      _tag: "DataSynced",
      data: data({ currentTaskId: "task-1" }),
    });
    const acked = plan(restored.runner, { _tag: "EditAcked" });
    expect(acked.runner!.tasks[1]!.sections[0]!.value).toBe("Old note");
    expect(acked.runner!.currentTaskId).toBe("task-1");
  });

  it("selecting an open task just switches current task", () => {
    const { runner } = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-1" });
    expect(runner!.currentTaskId).toBe("task-1");
  });

  it("a fresh runner can cancel a recovered edit without a UI backup", () => {
    const editing = data({
      tasks: [
        {
          id: "task-1",
          orderIndex: 0,
          endDate: null,
          isBeingEdited: false,
          sections: [section("f-activity", "Activity", "textInput", true, "Typing", 0)],
        },
        {
          id: "task-2",
          orderIndex: 1,
          endDate: 1_700_000_000_500,
          isBeingEdited: true,
          sections: [section("f-note", "Notes", "textArea", false, "Changed", 0)],
        },
      ],
    });
    const recovered = plan(null, { _tag: "DataSynced", data: editing });
    const { runner, emissions } = plan(recovered.runner, { _tag: "EditCancelled" });
    expect(emissions).toEqual([{ _tag: "CommitCancelEdit", taskId: "task-2" }]);
    expect(runner!.currentTaskId).toBe("task-1");
  });

  it("allows cancel to be retried when persistence fails", () => {
    const editing = data({
      currentTaskId: "task-2",
      tasks: data().tasks.map((task) => ({
        ...task,
        isBeingEdited: task.id === "task-2",
        sections: task.sections.map((field) =>
          field.id === "f-note" ? { ...field, value: "Changed" } : field,
        ),
      })),
    });
    const cancelled = plan(liveRunner(editing), {
      _tag: "EditCancelled",
    });

    // FailedRunnerOp only adds lastError in the parent reducer; no EditAcked is sent.
    const failed = { ...cancelled.runner!, lastError: "write failed" };
    const reselected = plan(failed, { _tag: "TaskSelected", taskId: "task-2" });
    const retried = plan(reselected.runner, { _tag: "EditCancelled" });

    expect(retried.emissions).toEqual([{ _tag: "CommitCancelEdit", taskId: "task-2" }]);
  });

  it("EditSaved gates and commits", () => {
    const editing = data({
      tasks: [
        {
          id: "task-1",
          orderIndex: 0,
          endDate: null,
          isBeingEdited: false,
          sections: [section("f-activity", "Activity", "textInput", true, "Typing", 0)],
        },
        {
          id: "task-2",
          orderIndex: 1,
          endDate: 1_700_000_000_500,
          isBeingEdited: true,
          sections: [section("f-note", "Notes", "textArea", false, "Fixed", 0)],
        },
      ],
    });
    const { emissions } = plan(liveRunner(editing), { _tag: "EditSaved" });
    expect(emissions).toEqual([{ _tag: "CommitSaveEdit", taskId: "task-2" }]);
  });

  it("allows cancellation when save persistence fails", () => {
    const editing = data({
      currentTaskId: "task-2",
      tasks: data().tasks.map((task) => ({
        ...task,
        isBeingEdited: task.id === "task-2",
        sections: task.sections.map((field) =>
          field.id === "f-note" ? { ...field, value: "Fixed" } : field,
        ),
      })),
    });
    const saved = plan(liveRunner(editing), {
      _tag: "EditSaved",
    });

    // A failed save leaves edit mode active in persistence, allowing cancel rollback.
    const failed = { ...saved.runner!, lastError: "write failed" };
    const cancelled = plan(failed, { _tag: "EditCancelled" });

    expect(cancelled.emissions).toEqual([{ _tag: "CommitCancelEdit", taskId: "task-2" }]);
  });
});

describe("sessionMachine end flow", () => {
  it("same-session sync retains confirmation, but a new session resets it", () => {
    const confirming = plan(liveRunner({ focusedSectionId: "f-category" }), {
      _tag: "EndRequested",
    });
    const refreshed = planFrom(confirming, {
      _tag: "DataSynced",
      data: data({ sessionName: "Renamed" }),
    });
    expect(refreshed.phase).toBe("confirming");
    expect(refreshed.runner!.sessionName).toBe("Renamed");
    expect(refreshed.runner!.focusedSectionId).toBe("f-category");
    expect(refreshed.runner!.showEndConfirm).toBe(true);

    const replaced = planFrom(refreshed, {
      _tag: "DataSynced",
      data: data({ sessionId: "sess-2" }),
    });
    expect(replaced.phase).toBe("collecting");
    expect(replaced.runner!.sessionId).toBe("sess-2");
    expect(replaced.runner!.focusedSectionId).toBeNull();
    expect(replaced.runner!.showEndConfirm).toBe(false);
    expect(replaced.emissions).toEqual([]);
  });

  it("parent updates preserve confirmation and collecting-only commands stay blocked", () => {
    const confirming = plan(liveRunner(), { _tag: "EndRequested" });
    const toggled = planFrom(confirming, { _tag: "TaskListToggled" });
    expect(toggled.phase).toBe("confirming");
    expect(toggled.runner!.showTaskList).toBe(true);
    const blocked = planFrom(toggled, {
      _tag: "FieldChanged",
      taskFieldId: "f-category",
      value: "B",
    });
    expect(blocked.phase).toBe("confirming");
    expect(blocked.runner).toEqual(toggled.runner);
    expect(blocked.emissions).toEqual([]);
  });

  it("EndRequested opens the confirmation (showEndConfirm via phase)", () => {
    const { runner, phase } = plan(liveRunner(), { _tag: "EndRequested" });
    expect(phase).toBe("confirming");
    expect(runner!.showEndConfirm).toBe(true);
  });

  it("EndCancelled returns to collecting", () => {
    const confirming = plan(liveRunner(), { _tag: "EndRequested" });
    const { runner, phase } = planFrom(confirming, {
      _tag: "EndCancelled",
    });
    expect(phase).toBe("collecting");
    expect(runner!.showEndConfirm).toBe(false);
  });

  it("EndConfirmed emits CommitEndSession then EndAcked goes Idle", () => {
    const confirming = plan(liveRunner(), { _tag: "EndRequested" });
    const confirmed = planFrom(confirming, { _tag: "EndConfirmed" });
    expect(confirmed.emissions).toEqual([{ _tag: "CommitEndSession", sessionId: "sess-1" }]);
    expect(confirmed.phase).toBe("collecting");
    expect(confirmed.runner!.showEndConfirm).toBe(false);
    const acked = planFrom(confirmed, { _tag: "EndAcked" });
    expect(acked.runner).toBeNull();
  });
});

describe("nextFocusForField", () => {
  it("no-ops for non-radio fields", () => {
    expect(nextFocusForField(data(), "f-activity", "x")).toEqual({ changed: false, next: null });
  });
  it("advances to the first unfulfilled section", () => {
    const d = data();
    const task = d.tasks[0]!;
    const unsorted = {
      ...d,
      tasks: [
        {
          ...task,
          sections: [
            section("later", "Later", "textInput", true, "", 4),
            section("radio", "Category", "radio", true, "", 1),
            section("done", "Done", "textInput", true, "Answered", 2),
            section("next", "Notes", "textInput", false, "", 3),
          ],
        },
      ],
    };
    expect(nextFocusForField(unsorted, "radio", "A")).toEqual({ changed: true, next: "next" });
    expect(nextFocusForField(unsorted, "radio", "")).toEqual({ changed: false, next: null });
  });
});

// ── Batched field writes ─────────────────────────────────────────────────────

const writesOf = (emissions: ReadonlyArray<{ _tag: string }>) =>
  emissions.filter((emission) => emission._tag === "CommitFieldValues");

describe("sessionMachine field writes", () => {
  const type = (runner: RunnerState | null, taskFieldId: string, value: string) =>
    plan(runner, { _tag: "FieldChanged", taskFieldId, value });

  it("writes a typed answer's first keystroke at once, then batches until a pause", () => {
    const first = type(liveRunner(), "f-activity", "O");
    // Dispatched now so the store's COALESCE start time is the first keystroke.
    expect(first.emissions).toEqual([
      { _tag: "CommitFieldValues", writes: [{ taskFieldId: "f-activity", value: "O" }] },
    ]);
    let current = first;
    for (const value of ["Ob", "Obs", "Observe"]) {
      current = type(current.runner, "f-activity", value);
      expect(current.emissions).toEqual([]);
    }
    // The runner shows every keystroke at once.
    expect(current.runner!.tasks[0]!.sections[0]!.value).toBe("Observe");
    expect(current.runner!.fieldWrites.revision).toBe(4);

    const flushed = plan(current.runner, { _tag: "FlushRequested" });
    expect(flushed.emissions).toEqual([
      { _tag: "CommitFieldValues", writes: [{ taskFieldId: "f-activity", value: "Observe" }] },
    ]);
    // Kept, marked dispatched, until the store echoes the value.
    expect(flushed.runner!.fieldWrites.pending).toEqual([
      { taskFieldId: "f-activity", value: "Observe", committed: true },
    ]);
    // Nothing left: a second flush is a no-op.
    const again = plan(flushed.runner, { _tag: "FlushRequested" });
    expect(again.emissions).toEqual([]);
    expect(again.runner).toBe(flushed.runner);
  });

  it("types 20 characters into a started answer with one write", () => {
    const started = liveRunner({
      tasks: data().tasks.map((task) => ({
        ...task,
        sections: task.sections.map((field) => ({ ...field, startDate: 1_700_000_000_100 })),
      })),
    });
    let current = plan(started, { _tag: "SectionFocused", fieldId: "f-activity" });
    const text = "Tightened four bolts";
    let emitted = 0;
    for (let index = 1; index <= text.length; index += 1) {
      current = type(current.runner, "f-activity", text.slice(0, index));
      emitted += writesOf(current.emissions).length;
    }
    const flushed = plan(current.runner, { _tag: "FlushRequested" });
    emitted += writesOf(flushed.emissions).length;
    expect(text).toHaveLength(20);
    expect(emitted).toBe(1);
  });

  it("writes discrete choices at once", () => {
    const { emissions } = type(liveRunner(), "f-category", "A");
    expect(emissions).toEqual([
      { _tag: "CommitFieldValues", writes: [{ taskFieldId: "f-category", value: "A" }] },
    ]);
  });

  it("keeps an unwritten answer when a stale store emission arrives", () => {
    const first = type(liveRunner(), "f-activity", "O");
    const typed = type(first.runner, "f-activity", "Observe");
    // The store has not seen either keystroke yet.
    const stale = plan(typed.runner, { _tag: "DataSynced", data: data() });
    const activity = stale.runner!.tasks[0]!.sections[0]!;
    expect(activity.value).toBe("Observe");
    // The locally stamped start survives until the store reports its own.
    expect(activity.startDate).toBe(1_700_000_001_000);
    expect(stale.runner!.fieldWrites.pending).toHaveLength(1);
  });

  it("drops a dispatched answer from the overlay once the store reflects it", () => {
    const first = type(liveRunner(), "f-category", "B");
    const echoed = data({
      tasks: data().tasks.map((task) => ({
        ...task,
        sections: task.sections.map((field) =>
          field.id === "f-category"
            ? { ...field, value: "B", startDate: 1_700_000_000_900 }
            : field,
        ),
      })),
    });
    const synced = plan(first.runner, { _tag: "DataSynced", data: echoed });
    expect(synced.runner!.fieldWrites.pending).toEqual([]);
    expect(synced.runner!.tasks[0]!.sections[1]!.startDate).toBe(1_700_000_000_900);
  });

  it.each([
    ["RecordRequested", { _tag: "RecordRequested" }, "CommitRecord"],
    ["EndConfirmed", { _tag: "EndConfirmed" }, "CommitEndSession"],
    ["TaskSelected", { _tag: "TaskSelected", taskId: "task-2" }, "CommitSelectTask"],
    [
      "CounterAdjusted",
      { _tag: "CounterAdjusted", taskFieldId: "f-count", delta: 1 },
      "CommitCounterAdjustment",
    ],
  ] as const)("writes pending answers before %s", (_, event, command) => {
    const base = liveRunner({
      tasks: data().tasks.map((task) =>
        task.id === "task-1"
          ? {
              ...task,
              sections: [
                ...task.sections.map((field) => ({ ...field, startDate: 1_700_000_000_100 })),
                { ...section("f-count", "Count", "counter", false, "1", 2), startDate: 1 },
              ],
            }
          : task,
      ),
    });
    const answered = type(base, "f-category", "A");
    const typed = type(answered.runner, "f-activity", "Observed");
    expect(typed.emissions).toEqual([]);
    const ready =
      event._tag === "EndConfirmed" ? plan(typed.runner, { _tag: "EndRequested" }) : typed;
    const next = plan(ready.runner, event);
    expect(next.emissions.map((emission) => emission._tag)).toEqual(["CommitFieldValues", command]);
    expect(next.emissions[0]).toEqual({
      _tag: "CommitFieldValues",
      writes: [{ taskFieldId: "f-activity", value: "Observed" }],
    });
    expect(next.runner!.fieldWrites.pending.every((write) => write.committed)).toBe(true);
  });

  it("keeps a dispatched answer when an earlier write's emission arrives", () => {
    const first = type(liveRunner(), "f-activity", "Obs");
    const typed = type(first.runner, "f-activity", "Observe");
    const flushed = plan(typed.runner, { _tag: "FlushRequested" });
    // The first write's echo arrives while the flushed write is still in flight.
    const earlier = data({
      tasks: data().tasks.map((task) => ({
        ...task,
        sections: task.sections.map((field) =>
          field.id === "f-activity" ? { ...field, value: "Obs", startDate: 1 } : field,
        ),
      })),
    });
    const stale = plan(flushed.runner, { _tag: "DataSynced", data: earlier });
    expect(stale.runner!.tasks[0]!.sections[0]!.value).toBe("Observe");
    const echoed = plan(stale.runner, {
      _tag: "DataSynced",
      data: data({
        tasks: earlier.tasks.map((task) => ({
          ...task,
          sections: task.sections.map((field) =>
            field.id === "f-activity" ? { ...field, value: "Observe" } : field,
          ),
        })),
      }),
    });
    expect(echoed.runner!.fieldWrites.pending).toEqual([]);
  });

  it("drops the overlay for a task the store no longer lets you edit", () => {
    const typed = type(liveRunner(), "f-activity", "Late");
    const finished = data({
      tasks: data().tasks.map((task) =>
        task.id === "task-1" ? { ...task, endDate: 1_700_000_000_900 } : task,
      ),
    });
    const synced = plan(typed.runner, { _tag: "DataSynced", data: finished });
    expect(synced.runner!.fieldWrites.pending).toEqual([]);
  });

  it("writes pending answers before an edit is cancelled, which then restores them", () => {
    const editing = data({
      currentTaskId: "task-2",
      tasks: data().tasks.map((task) => ({
        ...task,
        isBeingEdited: task.id === "task-2",
        sections: task.sections.map((field) => ({ ...field, startDate: 1 })),
      })),
    });
    const synced = plan(liveRunner(), { _tag: "DataSynced", data: editing });
    const typed = type(synced.runner, "f-note", "Draft");
    const cancelled = plan(typed.runner, { _tag: "EditCancelled" });
    expect(cancelled.emissions).toEqual([
      { _tag: "CommitFieldValues", writes: [{ taskFieldId: "f-note", value: "Draft" }] },
      { _tag: "CommitCancelEdit", taskId: "task-2" },
    ]);
  });

  it("ignores typing into a task that is no longer editable", () => {
    const typed = type(liveRunner(), "f-note", "Late");
    expect(typed.emissions).toEqual([]);
    expect(typed.runner!.fieldWrites.pending).toEqual([]);
  });
});
