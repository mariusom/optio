import { describe, expect, it } from "vitest";

import { Machine } from "@typeonce/effect-machine";
import { Effect } from "effect";

import { planSession } from "./plan";
import {
  freshLiveValue,
  nextFocusForField,
  SessionEvents,
  SessionMachine,
  SessionStates,
  type RunnerData,
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

const liveRunner = (overrides: Partial<Parameters<typeof planSession>[0]> = {}) => ({
  ...data(),
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: true,
  lastError: null,
  now: 1_700_000_001_000,
  showEndConfirm: false,
  editBackup: null,
  ...overrides,
});

// ── Helper: plan via the bridge, asserting no error ─────────────────────────

const plan = (
  runner: ReturnType<typeof liveRunner> | null,
  event: Parameters<typeof planSession>[2],
) => planSession(runner, "collecting", event);

// ── Tests ───────────────────────────────────────────────────────────────────

describe("sessionMachine topology", () => {
  it("starts Idle", () => {
    expect(
      SessionStates.matches(Effect.runSync(Machine.planInitial(SessionMachine)).state, "Idle"),
    ).toBe(true);
  });

  it("enters Live.Collecting with fresh controls on first DataSynced", () => {
    const { runner, phase } = plan(null, SessionEvents.DataSynced({ data: data() } as never));
    expect(phase).toBe("collecting");
    expect(runner).not.toBeNull();
    expect(runner!.focusedSectionId).toBeNull();
    expect(runner!.showSidebar).toBe(true);
    expect(runner!.showEndConfirm).toBe(false);
    expect(runner!.editBackup).toBeNull();
  });

  it("returns to Idle when DataSynced null", () => {
    const { runner } = plan(liveRunner(), { _tag: "DataSynced", data: null });
    expect(runner).toBeNull();
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
  it("emits CommitFieldValue and keeps focus for non-radio fields", () => {
    const { runner, emissions } = plan(liveRunner(), {
      _tag: "FieldChanged",
      taskFieldId: "f-activity",
      value: "More typing",
    });
    expect(emissions).toEqual([
      { _tag: "CommitFieldValue", taskFieldId: "f-activity", value: "More typing" },
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
    expect(runner!.lastError).toBe("Please complete required fields before recording.");
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

  it("RecordAcked clears focus and task list", () => {
    const { runner } = plan(liveRunner({ focusedSectionId: "f-activity", showTaskList: true }), {
      _tag: "RecordAcked",
    });
    expect(runner!.focusedSectionId).toBeNull();
    expect(runner!.showTaskList).toBe(false);
  });
});

describe("sessionMachine task selection + edit", () => {
  it("selecting a finished task opens edit mode (backup + CommitSelectTask)", () => {
    const { runner, emissions } = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-2" });
    expect(emissions).toEqual([
      { _tag: "CommitSelectTask", sessionId: "sess-1", taskId: "task-2" },
    ]);
    expect(runner!.editBackup).toEqual({ taskId: "task-2", values: { "f-note": "Old note" } });
    expect(runner!.currentTaskId).toBe("task-2");
  });

  it("selecting an open task just switches current task", () => {
    const { runner } = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-1" });
    expect(runner!.editBackup).toBeNull();
    expect(runner!.currentTaskId).toBe("task-1");
  });

  it("EditCancelled commits the backup restore", () => {
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
    const { runner, emissions } = plan(
      liveRunner({
        ...editing,
        editBackup: { taskId: "task-2", values: { "f-note": "Old note" } },
      }),
      { _tag: "EditCancelled" },
    );
    expect(emissions).toEqual([
      { _tag: "CommitCancelEdit", taskId: "task-2", backup: { "f-note": "Old note" } },
    ]);
    expect(runner!.editBackup).toBeNull();
    expect(runner!.currentTaskId).toBe("task-1");
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
    const { runner, emissions } = plan(
      liveRunner({
        ...editing,
        editBackup: { taskId: "task-2", values: { "f-note": "Old note" } },
      }),
      { _tag: "EditSaved" },
    );
    expect(emissions).toEqual([{ _tag: "CommitSaveEdit", taskId: "task-2" }]);
    expect(runner!.editBackup).toBeNull();
  });
});

describe("sessionMachine end flow", () => {
  it("EndRequested opens the confirmation (showEndConfirm via phase)", () => {
    const { runner, phase } = plan(liveRunner(), { _tag: "EndRequested" });
    expect(phase).toBe("confirming");
    expect(runner!.showEndConfirm).toBe(true);
  });

  it("EndCancelled returns to collecting", () => {
    const confirming = plan(liveRunner(), { _tag: "EndRequested" });
    const { runner, phase } = planSession(confirming.runner, "confirming", {
      _tag: "EndCancelled",
    });
    expect(phase).toBe("collecting");
    expect(runner!.showEndConfirm).toBe(false);
  });

  it("EndConfirmed emits CommitEndSession then EndAcked goes Idle", () => {
    const confirming = plan(liveRunner(), { _tag: "EndRequested" });
    const { emissions } = planSession(confirming.runner, "confirming", { _tag: "EndConfirmed" });
    expect(emissions).toEqual([{ _tag: "CommitEndSession", sessionId: "sess-1" }]);
    const acked = planSession(confirming.runner, "confirming", { _tag: "EndAcked" });
    expect(acked.runner).toBeNull();
  });
});

describe("nextFocusForField", () => {
  it("no-ops for non-radio fields", () => {
    expect(nextFocusForField(data(), "f-activity", "x")).toEqual({ changed: false, next: null });
  });
  it("advances to the first unfulfilled section", () => {
    const d = data();
    const fc = nextFocusForField(d, "f-category", "A");
    expect(fc.changed).toBe(true);
    expect(fc.next).toBeNull(); // no sections after the radio
  });
});
