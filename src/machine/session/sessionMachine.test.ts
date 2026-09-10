import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";

import { Machine } from "@typeonce/effect-machine";
import { Effect } from "effect";

import { planSession } from "./plan";
import {
  nextFocusForField,
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
  it.effect("starts Idle", () =>
    Effect.gen(function* () {
      expect(
        SessionStates.matches((yield* Machine.planInitial(SessionMachine)).state, "Idle"),
      ).toBe(true);
    }),
  );

  it("keeps the current state and suppresses emissions when snapshot decoding fails", () => {
    const runner = liveRunner({ completedCount: "invalid" as never });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(planSession(runner, "confirming", { _tag: "EndConfirmed" })).toEqual({
        runner,
        phase: "confirming",
        emissions: [],
      });
      expect(log).toHaveBeenCalledWith("[sessionMachine] plan failed", expect.anything());
    } finally {
      log.mockRestore();
    }
  });

  it("enters Live.Collecting with fresh controls on first DataSynced", () => {
    const { runner, phase } = plan(null, { _tag: "DataSynced", data: data() });
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
  it("selecting a finished task opens edit mode (backup + CommitSelectTask)", () => {
    const { runner, emissions } = plan(liveRunner(), { _tag: "TaskSelected", taskId: "task-2" });
    expect(emissions).toEqual([
      { _tag: "CommitSelectTask", sessionId: "sess-1", taskId: "task-2" },
    ]);
    expect(runner!.editBackup).toEqual({ taskId: "task-2", values: { "f-note": "Old note" } });
    expect(runner!.currentTaskId).toBe("task-2");
  });

  it("select → sync → change → sync → reselect → cancel restores the original backup", () => {
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
      { _tag: "CommitFieldValue", taskFieldId: "f-note", value: "Changed" },
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
    expect(reselected.runner!.editBackup).toEqual(selected.runner!.editBackup);
    const resynced = plan(reselected.runner, { _tag: "DataSynced", data: changedData });
    const cancelled = plan(resynced.runner, { _tag: "EditCancelled" });
    expect(cancelled.emissions).toEqual([
      { _tag: "CommitCancelEdit", taskId: "task-2", backup: { "f-note": "Old note" } },
    ]);
    const restored = plan(cancelled.runner, {
      _tag: "DataSynced",
      data: data({ currentTaskId: "task-1" }),
    });
    const acked = plan(restored.runner, { _tag: "EditAcked" });
    expect(acked.runner!.tasks[1]!.sections[0]!.value).toBe("Old note");
    expect(acked.runner!.editBackup).toBeNull();
    expect(acked.runner!.currentTaskId).toBe("task-1");
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
    expect(runner!.editBackup).toEqual({ taskId: "task-2", values: { "f-note": "Old note" } });
    expect(runner!.currentTaskId).toBe("task-1");
  });

  it("retains the original backup when cancel fails and the task is reselected and retried", () => {
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
    const originalBackup = { taskId: "task-2", values: { "f-note": "Old note" } };
    const cancelled = plan(liveRunner({ ...editing, editBackup: originalBackup }), {
      _tag: "EditCancelled",
    });

    // FailedRunnerOp only adds lastError in the parent reducer; no EditAcked is sent.
    const failed = { ...cancelled.runner!, lastError: "write failed" };
    const reselected = plan(failed, { _tag: "TaskSelected", taskId: "task-2" });
    const retried = plan(reselected.runner, { _tag: "EditCancelled" });

    expect(reselected.runner!.editBackup).toEqual(originalBackup);
    expect(retried.emissions).toEqual([
      { _tag: "CommitCancelEdit", taskId: "task-2", backup: { "f-note": "Old note" } },
    ]);
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
    expect(runner!.editBackup).toEqual({ taskId: "task-2", values: { "f-note": "Old note" } });
  });

  it("retains rollback values when save persistence fails", () => {
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
    const originalBackup = { taskId: "task-2", values: { "f-note": "Old note" } };
    const saved = plan(liveRunner({ ...editing, editBackup: originalBackup }), {
      _tag: "EditSaved",
    });

    // A failed save leaves edit mode active in persistence, allowing cancel rollback.
    const failed = { ...saved.runner!, lastError: "write failed" };
    const cancelled = plan(failed, { _tag: "EditCancelled" });

    expect(saved.runner!.editBackup).toEqual(originalBackup);
    expect(cancelled.emissions).toEqual([
      { _tag: "CommitCancelEdit", taskId: "task-2", backup: { "f-note": "Old note" } },
    ]);
  });
});

describe("sessionMachine end flow", () => {
  it("same-session sync retains confirmation, but a new session resets it", () => {
    const confirming = plan(liveRunner({ focusedSectionId: "f-category" }), {
      _tag: "EndRequested",
    });
    const refreshed = planSession(confirming.runner, "confirming", {
      _tag: "DataSynced",
      data: data({ sessionName: "Renamed" }),
    });
    expect(refreshed.phase).toBe("confirming");
    expect(refreshed.runner!.sessionName).toBe("Renamed");
    expect(refreshed.runner!.focusedSectionId).toBe("f-category");
    expect(refreshed.runner!.showEndConfirm).toBe(true);

    const replaced = planSession(refreshed.runner, "confirming", {
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
    const toggled = planSession(confirming.runner, "confirming", { _tag: "TaskListToggled" });
    expect(toggled.phase).toBe("confirming");
    expect(toggled.runner!.showTaskList).toBe(true);
    const blocked = planSession(toggled.runner, "confirming", {
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
    const { runner, phase } = planSession(confirming.runner, "confirming", {
      _tag: "EndCancelled",
    });
    expect(phase).toBe("collecting");
    expect(runner!.showEndConfirm).toBe(false);
  });

  it("EndConfirmed emits CommitEndSession then EndAcked goes Idle", () => {
    const confirming = plan(liveRunner(), { _tag: "EndRequested" });
    const confirmed = planSession(confirming.runner, "confirming", { _tag: "EndConfirmed" });
    expect(confirmed.emissions).toEqual([{ _tag: "CommitEndSession", sessionId: "sess-1" }]);
    expect(confirmed.phase).toBe("collecting");
    expect(confirmed.runner!.showEndConfirm).toBe(false);
    const acked = planSession(confirmed.runner, confirmed.phase, { _tag: "EndAcked" });
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
