import { Effect, Schema as S } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { getStore } from "../../../livestore/client";
import { events, tables, type FieldDef } from "../../../livestore/schema";

// ── Helpers ────────────────────────────────────────────────────────────────

const safeArray = (json: string): ReadonlyArray<string> => {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const toEpoch = (v: number | Date | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.getTime() : Number(v);
};

// ── UpdateFieldValue → taskFieldValueChanged (COALESCE startDate) ──────────

export const UpdateFieldValue = Command.define("UpdateFieldValue", {
  args: { taskFieldId: S.String, value: S.String },
  messages: [Message.UpdatedFieldValue, Message.FailedRunnerOp],
  execute: ({ taskFieldId, value }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      store.commit(events.taskFieldValueChanged({ id: taskFieldId, value, now: new Date() }));
      return Message.UpdatedFieldValue();
    }).pipe(Effect.catch((e) => Effect.succeed(Message.FailedRunnerOp({ error: String(e) })))),
});

// ── RecordTask → taskFinished + taskSpawned ─────────────────────────────────

export const RecordTask = Command.define("RecordTask", {
  args: { sessionId: S.String, currentTaskId: S.String },
  messages: [Message.TaskRecorded, Message.FailedRunnerOp],
  execute: ({ sessionId, currentTaskId }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);

      // Fetch current task to check canRecord implicitly via isDone? We do light guard:
      // Find task and its fields
      const taskRows = store.query(
        tables.sessionTasks.select().where({ sessionId }),
      ) as ReadonlyArray<{
        id: string;
        orderIndex: number;
        endDate: Date | number | null;
        isBeingEdited: number;
      }>;
      const currentRow = taskRows.find((r) => r.id === currentTaskId);
      if (currentRow === undefined) {
        return Message.FailedRunnerOp({ error: "Current task not found" });
      }
      // Guard: if task already finished, no-op
      if (currentRow.endDate !== null && currentRow.endDate !== undefined) {
        return Message.TaskRecorded();
      }

      // Fetch fields of current task to check required completeness and to spawn next
      const fieldRows = store.query(
        tables.sessionTaskFields
          .select()
          .where({ taskId: currentTaskId })
          .orderBy("sortOrder", "asc"),
      ) as ReadonlyArray<{
        id: string;
        name: string;
        kind: string;
        isRequired: number;
        defaultValue: string;
        sortOrder: number;
        optionsJson: string;
        exclusiveOptionsJson: string;
        value: string;
        startDate: Date | number | null;
      }>;

      // Check canRecord: all required sections must be non-empty
      const notDone = fieldRows.some(
        (r) => r.isRequired === 1 && (r.value === "" || r.value === null),
      );
      if (notDone) {
        return Message.FailedRunnerOp({ error: "Cannot record: required fields empty" });
      }

      // Compute next orderIndex = max +1
      const maxOrder = taskRows.reduce((m, r) => Math.max(m, Number(r.orderIndex)), 0);
      const nextOrder = maxOrder + 1;

      // Build FieldDefs for next task from current task's field definitions (template defaults)
      const nextFields: FieldDef[] = fieldRows.map((r) => ({
        id: crypto.randomUUID(),
        name: r.name,
        kind: r.kind as FieldDef["kind"],
        isRequired: r.isRequired === 1,
        defaultValue: r.defaultValue,
        sortOrder: r.sortOrder,
        options: [...safeArray(r.optionsJson)],
        exclusiveOptions: [...safeArray(r.exclusiveOptionsJson)],
      }));
      // Sort by sortOrder to ensure correct order (already ordered, but ensure)
      nextFields.sort((a, b) => a.sortOrder - b.sortOrder);

      const nextTaskId = crypto.randomUUID();
      store.commit(
        events.taskFinished({ id: currentTaskId, endedAt: new Date() }),
        events.taskSpawned({
          sessionId,
          id: nextTaskId,
          orderIndex: nextOrder,
          fields: nextFields,
        }),
      );
      return Message.TaskRecorded();
    }).pipe(Effect.catch((e) => Effect.succeed(Message.FailedRunnerOp({ error: String(e) })))),
});

// ── EndSession → archive or delete then clear live graph, navigate ─────────

export const EndSession = Command.define("EndSession", {
  args: { sessionId: S.String },
  messages: [Message.SessionEnded, Message.FailedRunnerOp],
  execute: ({ sessionId }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);

      const taskRows = store.query(
        tables.sessionTasks.select().where({ sessionId }).orderBy("orderIndex", "asc"),
      ) as ReadonlyArray<{
        id: string;
        orderIndex: number;
        taskType: string;
        endDate: Date | number | null;
      }>;

      const finished = taskRows.filter((r) => r.endDate !== null && r.endDate !== undefined);

      if (finished.length === 0) {
        // No tasks saved → delete live graph + session entirely
        store.commit(
          events.sessionLiveGraphCleared({ sessionId }),
          events.sessionDeleted({ id: sessionId }),
        );
        return Message.SessionEnded();
      }

      // Build records for each finished task
      type SectionRecord = {
        sectionName: string;
        value: string;
        sectionType: string;
        isRequired: boolean;
        startedAt: Date | null;
      };
      type TaskRecord = {
        taskIdNumber: number;
        taskType: string;
        startedAt: Date | null;
        endedAt: Date | null;
        sections: SectionRecord[];
      };

      const records: TaskRecord[] = [];

      for (const task of finished) {
        const fieldRows = store.query(
          tables.sessionTaskFields.select().where({ taskId: task.id }).orderBy("sortOrder", "asc"),
        ) as ReadonlyArray<{
          name: string;
          kind: string;
          isRequired: number;
          value: string;
          startDate: Date | number | null;
        }>;

        // task startedAt = min startDate among sections (null if untouched)
        const starts = fieldRows
          .map((r) => toEpoch(r.startDate as number | Date | null))
          .filter((v): v is number => v !== null);
        const taskStartedAt = starts.length > 0 ? new Date(Math.min(...starts)) : null;
        const taskEndedAt =
          task.endDate === null || task.endDate === undefined
            ? null
            : new Date(task.endDate as number | Date);

        const sections: SectionRecord[] = fieldRows.map((r) => ({
          sectionName: r.name,
          value: r.value,
          sectionType: r.kind,
          isRequired: r.isRequired === 1,
          startedAt:
            r.startDate === null || r.startDate === undefined
              ? null
              : new Date(r.startDate as number | Date),
        }));

        records.push({
          taskIdNumber: Number(task.orderIndex),
          taskType: task.taskType ?? "single",
          startedAt: taskStartedAt,
          endedAt: taskEndedAt,
          sections,
        });
      }

      // Sort records by taskId asc per spec
      records.sort((a, b) => a.taskIdNumber - b.taskIdNumber);

      store.commit(
        events.sessionEnded({ id: sessionId, endedAt: new Date(), records }),
        events.sessionLiveGraphCleared({ sessionId }),
      );
      return Message.SessionEnded();
    }).pipe(Effect.catch((e) => Effect.succeed(Message.FailedRunnerOp({ error: String(e) })))),
});

// ── SelectTask → taskEditStarted / taskEditFinished ─────────────────────────

export const SelectTask = Command.define("SelectTask", {
  args: { sessionId: S.String, taskId: S.String },
  messages: [Message.TaskEditStarted, Message.TaskEditFinished, Message.FailedRunnerOp],
  execute: ({ sessionId, taskId }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const taskRows = store.query(
        tables.sessionTasks.select().where({ sessionId }),
      ) as ReadonlyArray<{ id: string; endDate: Date | number | null; isBeingEdited: number }>;
      const target = taskRows.find((r) => r.id === taskId);
      if (target === undefined) return Message.TaskEditStarted({ taskId });

      const isFinished = target.endDate !== null && target.endDate !== undefined;
      if (isFinished) {
        store.commit(events.taskEditStarted({ sessionId, id: taskId }));
        return Message.TaskEditStarted({ taskId });
      } else {
        // Selecting current (unfinished) → clear any editing
        const edited = taskRows.find((r) => r.isBeingEdited === 1);
        if (edited !== undefined) {
          store.commit(events.taskEditFinished({ id: edited.id }));
        }
        // Return finished to trigger UI update
        return Message.TaskEditFinished();
      }
    }).pipe(Effect.catch((e) => Effect.succeed(Message.FailedRunnerOp({ error: String(e) })))),
});

export const CancelEdit = Command.define("CancelEdit", {
  args: { taskId: S.String, backup: S.Record(S.String, S.String) },
  messages: [Message.TaskEditFinished, Message.FailedRunnerOp],
  execute: ({ taskId, backup }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      const entries = Object.entries(backup as Record<string, string>);
      const restores = entries.map(([fieldId, value]) =>
        events.taskFieldValueRestored({ id: fieldId, value }),
      );
      store.commit(...restores, events.taskEditFinished({ id: taskId }));
      return Message.TaskEditFinished();
    }).pipe(Effect.catch((e) => Effect.succeed(Message.FailedRunnerOp({ error: String(e) })))),
});

export const SaveEdit = Command.define("SaveEdit", {
  args: { taskId: S.String },
  messages: [Message.TaskEditFinished, Message.FailedRunnerOp],
  execute: ({ taskId }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore);
      store.commit(events.taskEditFinished({ id: taskId }));
      return Message.TaskEditFinished();
    }).pipe(Effect.catch((e) => Effect.succeed(Message.FailedRunnerOp({ error: String(e) })))),
});
