import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";
import { TestClock } from "effect/testing";
import { vi } from "vite-plus/test";

import { init, subscriptions, update } from "../main";
import type { Model } from "../main";
import { Message } from "../messages";
import type { RunnerState } from "../web/features/session/runner";

vi.mock("../store/client", () => ({ getStore: vi.fn() }));

/** What the flush subscription sends for a runner holding answers at `revision`. */
const flushAfter = (deps: { revision: number | null; onRunner: boolean }) => {
  const model: Model = {
    ...init(deps.onRunner ? "#/session/s1" : "#/history").model,
    runner: {
      ...runner,
      fieldWrites:
        deps.revision === null
          ? { revision: 0, pending: [] }
          : {
              revision: deps.revision,
              pending: [{ taskFieldId: "notes", value: "Note", committed: false }],
            },
    },
  };
  const flush = subscriptions(model).find(
    (subscription) => subscription && subscription.name === "fieldWriteFlush",
  );
  return flush === undefined || flush === false
    ? Effect.succeed([])
    : Stream.runCollect(flush.stream);
};

describe("field write flush subscription", () => {
  it.effect("stays idle without pending answers", () =>
    Effect.gen(function* () {
      const flushed = yield* flushAfter({ revision: null, onRunner: true });
      expect(flushed).toEqual([]);
    }),
  );

  it.effect("writes pending answers once typing pauses", () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(flushAfter({ revision: 3, onRunner: true }));
      yield* TestClock.adjust("499 millis");
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 millis");
      const messages = yield* Fiber.join(fiber);
      expect(messages).toEqual([Message.SettledFieldInput()]);
    }),
  );

  it.effect("writes pending answers at once after leaving the runner", () =>
    Effect.gen(function* () {
      const flushed = yield* flushAfter({ revision: 3, onRunner: false });
      expect(flushed).toEqual([Message.SettledFieldInput()]);
    }),
  );
});

const runner: RunnerState = {
  sessionId: "s1",
  templateName: "Study",
  sessionName: "Line 4",
  startedAt: 0,
  now: 10,
  currentTaskId: "t1",
  completedCount: 0,
  focusedSectionId: null,
  showTaskList: false,
  showEndConfirm: false,
  showSidebar: true,
  lastError: null,
  fieldWrites: { revision: 0, pending: [] },
  announcement: null,
  tasks: [
    {
      id: "t1",
      orderIndex: 1,
      endDate: null,
      isBeingEdited: false,
      sections: [
        {
          id: "notes",
          taskId: "t1",
          name: "Notes",
          kind: "textArea",
          isRequired: false,
          defaultValue: "",
          sortOrder: 0,
          options: [],
          exclusiveOptions: [],
          value: "",
          startDate: 5,
        },
      ],
    },
  ],
};

const onRunner = (): Model => ({
  ...init("#/session/s1").model,
  runner,
});

const commandNames = (result: { commands?: ReadonlyArray<{ name: string }> }) =>
  (result.commands ?? []).map((command) => command.name);

describe("batched answers through the update loop", () => {
  it("holds typed answers until the flush, then writes the latest value once", () => {
    let model = onRunner();
    for (const value of ["N", "No", "Note"]) {
      const result = update(model, Message.ChangedFieldValue({ taskFieldId: "notes", value }));
      expect(commandNames(result)).toEqual([]);
      model = result.model;
    }
    expect(model.runner!.tasks[0]!.sections[0]!.value).toBe("Note");
    const flushed = update(model, Message.BlurredField());
    expect(flushed.commands).toEqual([
      expect.objectContaining({
        name: "UpdateFieldValues",
        args: { writes: [{ taskFieldId: "notes", value: "Note" }] },
      }),
    ]);
  });

  it("writes an assistant's answer immediately", () => {
    const model = onRunner();
    const result = update(
      model,
      Message.AgentRequest({
        requestId: "r1",
        action: { _tag: "ChangedFieldValue", taskFieldId: "notes", value: "From assistant" },
      }),
    );
    expect(commandNames(result)).toEqual(["UpdateFieldValues", "ReplyToAgent"]);
    expect(result.model.runner!.fieldWrites.pending).toEqual([
      { taskFieldId: "notes", value: "From assistant", committed: true },
    ]);
  });
});
