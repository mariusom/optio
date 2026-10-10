import { describe, expect, it } from "@effect/vitest";
import { vi } from "vitest";
import { Effect, Stream } from "effect";
import { AsyncData } from "foldkit";

import { Message } from "../../../messages";
import { subscriptions, update } from "../../../main";
import type { Model } from "../../../main";
import { getStore } from "../../../livestore/client";
import { isFullScreenRoute, SessionRunner, StartTab } from "../../routes";

vi.mock("../../../livestore/client", () => ({
  getStore: vi.fn(),
}));

// provide self for @livestore/adapter-web shared-worker stub (node env)
(globalThis as unknown as { self?: unknown }).self ??= globalThis;

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
    fieldWrites: { revision: 0, pending: [] },
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
  idSeed: "tablet-test",
  idCounter: 0,
  route: SessionRunner({ sessionId: "s1" }),
  now: Date.now(),
  theme: "auto",
  systemPrefersDark: false,
  themeSaveFailed: false,
  style: "nova",
  styleSaveFailed: false,
  styleLoadFailed: false,
  font: "sans",
  fontSaveFailed: false,
  iconLibrary: "lucide",
  iconLibrarySaveFailed: false,
  accent: "default",
  accentSaveFailed: false,
  accentDraft: null,
  templates: AsyncData.succeed([]),
  templatesSeedChecked: true,
  listReadAttempt: 0,
  showCreate: false,
  newName: "",
  pendingDelete: null,
  templateActionsFor: null,
  lastError: null,
  editor: null,
  selectedTemplateId: null,
  sessionNameInput: "",
  placeholderName: "Amber Canyon",
  activeSession: AsyncData.succeed(null),
  pendingDiscardSession: false,
  runner,
  history: AsyncData.succeed([]),
  selectedHistorySession: null,
  detailLoadFailed: false,
  pendingHistoryDelete: null,
  showEditHistoryName: false,
  editHistoryNameInput: "",
  selectedHistoryTaskId: null,
  historyActionsFor: null,
  pendingNavigationUrl: null,
  historyError: null,
  storage: "persisted",
  memoryStorageAcknowledged: false,
  promptCopyStatus: "idle",
  appUpdate: "none",
});

describe("runner dead links", () => {
  // The runner reads one combined query, so a session never appears without its tasks.
  it.effect.each([
    { label: "missing", endedAt: undefined, expectedData: null },
    { label: "ended", endedAt: new Date(1), expectedData: null },
    { label: "live", endedAt: null, expectedData: { sessionId: "s1", tasks: [] } },
  ])("treats a $label session correctly", ({ endedAt, expectedData }) =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockResolvedValue({
        subscribe: (_query: unknown, callback: (rows: unknown) => void) => {
          callback({
            session:
              endedAt === undefined
                ? null
                : {
                    id: "s1",
                    templateName: "T",
                    sessionName: "S",
                    startedAt: new Date(0),
                    endedAt,
                  },
            tasks: [],
            fields: [],
          });
          return () => {};
        },
      } as unknown as Awaited<ReturnType<typeof getStore>>);

      const messages = yield* subscriptions.runner
        .dependenciesToStream({ sessionId: "s1" })
        .pipe(Stream.take(1), Stream.runCollect);

      expect(messages[0]).toMatchObject({ _tag: "GotRunnerData", data: expectedData });
    }),
  );

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
