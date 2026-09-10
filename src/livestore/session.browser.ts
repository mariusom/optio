import { expect, it, vi } from "vitest";
import { Effect } from "effect";
import { createStorePromise } from "@livestore/livestore";
import { makeInMemoryAdapter } from "@livestore/adapter-web";

vi.mock("./client", () => ({ getStore: vi.fn() }));

import { getStore } from "./client";
import { events, schema, tables, type FieldDef } from "./schema";
import { CancelEdit, SaveEdit, SelectTask } from "../we/features/session/runnerCommands";
import { planSession } from "../machine/session/plan";

const fields: FieldDef[] = [
  {
    id: "a",
    name: "Activity",
    kind: "textInput",
    isRequired: true,
    defaultValue: "",
    sortOrder: 0,
    options: [],
    exclusiveOptions: [],
  },
  {
    id: "b",
    name: "Notes",
    kind: "textInput",
    isRequired: false,
    defaultValue: "Default",
    sortOrder: 1,
    options: [],
    exclusiveOptions: [],
  },
];

it("reconstructs an edited task from persisted events and Cancel restores original values", async () => {
  const store = await createStorePromise({
    schema,
    storeId: `recovery-${crypto.randomUUID()}`,
    adapter: makeInMemoryAdapter(),
  });
  vi.mocked(getStore).mockResolvedValue(store);
  try {
    // These events are the durable history, including a repeated selection after editing.
    store.commit(
      events.sessionStarted({
        id: "s",
        templateId: null,
        templateName: "Study",
        sessionName: "Round",
        now: new Date(500),
      }),
      events.taskSpawned({ sessionId: "s", id: "done", orderIndex: 1, fields }),
      events.taskFieldValueChanged({ id: "done:a", value: "Observed", now: new Date(1000) }),
      events.taskFinished({ id: "done", endedAt: new Date(2000) }),
      events.taskSpawned({ sessionId: "s", id: "open", orderIndex: 2, fields }),
      events.taskEditStarted({ sessionId: "s", id: "done" }),
      events.taskFieldValueChanged({ id: "done:a", value: "Correction", now: new Date(3000) }),
      events.taskFieldValueChanged({ id: "done:b", value: "Added later", now: new Date(4000) }),
      events.taskEditStarted({ sessionId: "s", id: "done" }),
    );
    const tasks = store.query(tables.sessionTasks.select()).map((task) => ({
      id: task.id,
      orderIndex: task.orderIndex,
      endDate: task.endDate?.getTime() ?? null,
      isBeingEdited: task.isBeingEdited === 1,
      sections: store
        .query(tables.sessionTaskFields.select().where({ taskId: task.id }))
        .map((field) => ({
          ...field,
          isRequired: field.isRequired === 1,
          options: [],
          exclusiveOptions: [],
          startDate: field.startDate?.getTime() ?? null,
        })),
    }));
    // A fresh model has no in-memory rollback snapshot, just the recovered store rows.
    const recovered = planSession(null, "collecting", {
      _tag: "DataSynced",
      data: {
        sessionId: "s",
        templateName: "Study",
        sessionName: "Round",
        startedAt: 500,
        tasks,
        currentTaskId: "done",
        completedCount: 1,
      },
    });
    const cancelled = planSession(recovered.runner, recovered.phase, { _tag: "EditCancelled" });
    expect(cancelled.emissions).toHaveLength(1);
    const emission = cancelled.emissions[0]!;
    expect(emission).toEqual({ _tag: "CommitCancelEdit", taskId: "done" });
    if (emission._tag !== "CommitCancelEdit") throw new Error("Expected cancellation");
    expect(await Effect.runPromise(CancelEdit(emission).effect)).toMatchObject({
      _tag: "TaskEditFinished",
    });
    const restored = store.query(
      tables.sessionTaskFields.select().where({ taskId: "done" }).orderBy("sortOrder", "asc"),
    );
    expect(restored.map((field) => field.value)).toEqual(["Observed", "Default"]);
    expect(restored.map((field) => field.startDate?.getTime())).toEqual([1000, 4000]);
    expect(store.query(tables.sessionTasks.select().where({ id: "done" }))[0]?.isBeingEdited).toBe(
      0,
    );
  } finally {
    await store.shutdownPromise();
  }
});

it.each(["save", "select open task"])(
  "%s consumes the snapshot and a later edit gets a fresh rollback",
  async (finish) => {
    const store = await createStorePromise({
      schema,
      storeId: `edit-${crypto.randomUUID()}`,
      adapter: makeInMemoryAdapter(),
    });
    vi.mocked(getStore).mockResolvedValue(store);
    try {
      store.commit(
        events.taskSpawned({ sessionId: "s", id: "done", orderIndex: 1, fields }),
        events.taskFieldValueChanged({ id: "done:a", value: "Original", now: new Date(1000) }),
        events.taskFinished({ id: "done", endedAt: new Date(2000) }),
        events.taskSpawned({ sessionId: "s", id: "open", orderIndex: 2, fields }),
        events.taskEditStarted({ sessionId: "s", id: "done" }),
        events.taskFieldValueChanged({
          id: "done:a",
          value: "Saved correction",
          now: new Date(3000),
        }),
      );
      const command =
        finish === "save"
          ? SaveEdit({ taskId: "done" })
          : SelectTask({ sessionId: "s", taskId: "open" });
      expect(await Effect.runPromise(command.effect)).toMatchObject({ _tag: "TaskEditFinished" });
      expect(
        store.query(tables.sessionTasks.select().where({ id: "done" }))[0]?.editBackup,
      ).toBeNull();
      // A delayed duplicate cancellation after the edit finished must not undo a save.
      await Effect.runPromise(CancelEdit({ taskId: "done" }).effect);
      expect(store.query(tables.sessionTaskFields.select().where({ id: "done:a" }))[0]?.value).toBe(
        "Saved correction",
      );
      store.commit(
        events.taskEditStarted({ sessionId: "s", id: "done" }),
        events.taskFieldValueChanged({ id: "done:a", value: "", now: new Date(4000) }),
      );
      expect(await Effect.runPromise(SaveEdit({ taskId: "done" }).effect)).toMatchObject({
        _tag: "FailedRunnerOp",
      });
      await Effect.runPromise(CancelEdit({ taskId: "done" }).effect);
      expect(store.query(tables.sessionTaskFields.select().where({ id: "done:a" }))[0]?.value).toBe(
        "Saved correction",
      );
    } finally {
      await store.shutdownPromise();
    }
  },
);
