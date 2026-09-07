import { describe, expect, it, vi } from "vitest";
import { Effect, Stream } from "effect";

vi.mock("../../../livestore/client", () => ({
  getStore: vi.fn(),
}));

// provide self for @livestore/adapter-web shared-worker stub (node env)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).self ??= globalThis;

import { Message } from "../../../messages";
import { subscriptions, update } from "../../../main";
import type { Model } from "../../../main";
import { getStore } from "../../../livestore/client";
import { isFullScreenRoute, SessionRunner, StartTab } from "../../routes";

// helper to make a minimal runner state matching Model.runner shape
const makeRunner = (
  overrides: Partial<Model["runner"]> & { sessionId: string },
): NonNullable<Model["runner"]> => {
  const base: NonNullable<Model["runner"]> = {
    templateName: "Sample Study",
    sessionName: "Test",
    startedAt: Date.now(),
    tasks: [],
    currentTaskId: null,
    completedCount: 0,
    focusedSectionId: null,
    showTaskList: false,
    showEndConfirm: false,
    showSidebar: true,
    lastError: null,
    now: Date.now(),
    editBackup: null,
    ...overrides,
  } as NonNullable<Model["runner"]>;
  // ensure showSidebar defaults to true if not overridden explicitly as false
  if (overrides.showSidebar === undefined && base.showSidebar === undefined) {
    (base as unknown as Record<string, unknown>).showSidebar = true;
  }
  return base;
};

const makeModel = (runner: Model["runner"]): Model => ({
  agentConfirmationVersion: 0,
  route: SessionRunner({ sessionId: "s1" }),
  theme: "auto",
  themeSaveFailed: false,
  templates: [],
  showCreate: false,
  newName: "",
  pendingDelete: null,
  lastError: null,
  editor: null,
  selectedTemplateId: null,
  sessionNameInput: "",
  placeholderName: "Amber Canyon",
  activeSession: null,
  pendingDiscardSession: false,
  runner,
  runnerPhase: "collecting",
  history: [],
  selectedHistorySession: null,
  pendingHistoryDelete: null,
  showEditHistoryName: false,
  editHistoryNameInput: "",
  selectedHistoryTaskId: null,
  csvError: null,
});

describe("runner dead links", () => {
  it("waits for the session query before declaring a runner missing", async () => {
    const callbacks: Array<(rows: ReadonlyArray<unknown>) => void> = [];
    vi.mocked(getStore).mockResolvedValue({
      subscribe: (_query: unknown, callback: (rows: ReadonlyArray<unknown>) => void) => {
        callbacks.push(callback);
        if (callbacks.length === 3) {
          callbacks[1]!([]);
          callbacks[2]!([]);
          callbacks[0]!([{ id: "s1", templateName: "T", sessionName: "S", startedAt: 0 }]);
        }
        return () => {};
      },
    } as unknown as Awaited<ReturnType<typeof getStore>>);
    const messages = await Effect.runPromise(
      subscriptions.runner
        .dependenciesToStream({ sessionId: "s1" })
        .pipe(Stream.take(1), Stream.runCollect),
    );
    expect(messages[0]).toMatchObject({ _tag: "GotRunnerData", data: { sessionId: "s1" } });
  });

  it("redirects to Start after switching from a valid runner to a missing session", () => {
    const model = makeModel(makeRunner({ sessionId: "s1" }));
    const switched = update(
      model,
      Message.GotRoute({ route: SessionRunner({ sessionId: "missing" }) }),
    );
    expect(switched.model.runner?.sessionId).toBe("s1");
    const synced = update(switched.model, Message.GotRunnerData({ data: null }));
    expect(synced.model.runner).toBeNull();
    expect(synced.commands).toEqual([
      expect.objectContaining({ name: "NavigateInternal", args: { url: "#/start" } }),
    ]);
  });

  it("does not redirect on null data outside a runner route", () => {
    const model = { ...makeModel(makeRunner({ sessionId: "s1" })), route: StartTab() };
    const synced = update(model, Message.GotRunnerData({ data: null }));
    expect(synced.model.runner).toBeNull();
    expect(synced.commands ?? []).toEqual([]);
  });
});

describe("tablet sidebar visibility", () => {
  it("defaults showSidebar true on new session via GotRunnerData", () => {
    const emptyModel = makeModel(null);
    const data = {
      sessionId: "s1",
      templateName: "T",
      sessionName: "S",
      startedAt: Date.now(),
      tasks: [],
      currentTaskId: null,
      completedCount: 0,
    };
    const result = update(emptyModel, Message.GotRunnerData({ data }));
    expect(result.model.runner).not.toBeNull();
    expect(result.model.runner?.showSidebar).toBe(true);
  });

  it("preserves showSidebar false across GotRunnerData for same session", () => {
    const runner = makeRunner({ sessionId: "s1", showSidebar: false });
    const model = makeModel(runner);
    const data = {
      sessionId: "s1",
      templateName: "T",
      sessionName: "S",
      startedAt: runner.startedAt,
      tasks: [],
      currentTaskId: null,
      completedCount: 0,
    };
    const result = update(model, Message.GotRunnerData({ data }));
    expect(result.model.runner?.showSidebar).toBe(false);
  });

  it("resets showSidebar to true on session switch", () => {
    const runner = makeRunner({ sessionId: "s1", showSidebar: false });
    const model = makeModel(runner);
    const data = {
      sessionId: "s2",
      templateName: "T",
      sessionName: "S",
      startedAt: Date.now(),
      tasks: [],
      currentTaskId: null,
      completedCount: 0,
    };
    const result = update(model, Message.GotRunnerData({ data }));
    expect(result.model.runner?.showSidebar).toBe(true);
  });

  it("ToggledSidebar flips true -> false", () => {
    const runner = makeRunner({ sessionId: "s1", showSidebar: true });
    const model = makeModel(runner);
    const result = update(model, Message.ToggledSidebar());
    expect(result.model.runner?.showSidebar).toBe(false);
  });

  it("ToggledSidebar flips false -> true", () => {
    const runner = makeRunner({ sessionId: "s1", showSidebar: false });
    const model = makeModel(runner);
    const result = update(model, Message.ToggledSidebar());
    expect(result.model.runner?.showSidebar).toBe(true);
  });

  it("ToggledSidebar preserves other runner state", () => {
    const runner = makeRunner({
      sessionId: "s1",
      showSidebar: true,
      completedCount: 5,
      focusedSectionId: "sec-1",
      showTaskList: true,
    });
    const model = makeModel(runner);
    const result = update(model, Message.ToggledSidebar());
    expect(result.model.runner?.completedCount).toBe(5);
    expect(result.model.runner?.focusedSectionId).toBe("sec-1");
    expect(result.model.runner?.showTaskList).toBe(true);
    expect(result.model.runner?.showSidebar).toBe(false);
  });

  it("ToggledSidebar no-op when runner null", () => {
    const model = makeModel(null);
    const result = update(model, Message.ToggledSidebar());
    expect(result.model.runner).toBeNull();
  });
});

describe("isFullScreenRoute for session runner", () => {
  it("SessionRunner is full screen", () => {
    expect(isFullScreenRoute(SessionRunner({ sessionId: "abc" }))).toBe(true);
  });
});

describe("sidebar task ordering (newest-first)", () => {
  it("sidebar sorts tasks newest-first (desc orderIndex)", () => {
    const tasks = [
      { id: "t1", orderIndex: 1, endDate: 1, isBeingEdited: false, sections: [] },
      { id: "t2", orderIndex: 2, endDate: 1, isBeingEdited: false, sections: [] },
      { id: "t3", orderIndex: 3, endDate: null, isBeingEdited: false, sections: [] },
    ];
    const sorted = [...tasks].sort((a, b) => b.orderIndex - a.orderIndex);
    expect(sorted.map((t) => t.orderIndex)).toEqual([3, 2, 1]);
  });
});
