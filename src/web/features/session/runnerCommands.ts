import { Array, DateTime, Effect, Option, Schema } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";
import { withStore, type StoreAccess } from "../../../livestore/access";
import { fieldRowsToDefs } from "../../fieldRows";
import { reportFailure } from "../../errors";
import { isScalarAnswerValid } from "../../fields";
import { serialized } from "./writeLock";
import { randomUuid, withFreshIds } from "../../../lib/ids";
import { archiveRecord } from "./archiveRecord";
import { isAnswerComplete, isTaskEditable } from "./runner";

// ── Helpers ────────────────────────────────────────────────────────────────

const now = DateTime.nowAsDate;

type AnswerRow = { readonly kind: string; readonly isRequired: number; readonly value: string };

const isIncomplete = (row: AnswerRow) =>
  !isAnswerComplete({ ...row, isRequired: row.isRequired === 1 });

const failed = (error: string) => Message.FailedRunnerOp({ error });

/**
 * Runner writes run one at a time in dispatch order. Commands start in the
 * order an update returns them, so batched answers commit before the record,
 * edit or end command that reads them.
 */

/** Store-side counterpart of the planner's editable-section guard. */
const isPersistedFieldEditable = (
  { store, tables }: Pick<StoreAccess, "store" | "tables">,
  taskFieldId: string,
): boolean => {
  const field = store.query(tables.sessionTaskFields.select().where({ id: taskFieldId }))[0];
  if (field === undefined) return false;
  const task = store.query(tables.sessionTasks.select().where({ id: field.taskId }))[0];
  return (
    task !== undefined &&
    isTaskEditable({ endDate: task.endDate, isBeingEdited: task.isBeingEdited === 1 })
  );
};

// ── UpdateFieldValues → taskFieldValueChanged (COALESCE startDate) ─────────

/** Commits a batch of answers together; each keeps its first-write time. */
export const UpdateFieldValues = Command.define("UpdateFieldValues", {
  args: {
    writes: Schema.Array(Schema.Struct({ taskFieldId: Schema.String, value: Schema.String })),
  },
  messages: [Message.UpdatedFieldValue, Message.FailedRunnerOp],
  execute: ({ writes }) =>
    withStore((access) =>
      Effect.gen(function* () {
        const committedAt = yield* now;
        // Recheck persisted editability: a late input must not change a completed task.
        const editable = Array.filter(writes, ({ taskFieldId }) =>
          isPersistedFieldEditable(access, taskFieldId),
        );
        if (editable.length > 0) {
          access.store.commit(
            ...Array.map(editable, ({ taskFieldId, value }) =>
              access.events.taskFieldValueChanged({ id: taskFieldId, value, now: committedAt }),
            ),
          );
        }
        return Message.UpdatedFieldValue();
      }),
    ).pipe(serialized, reportFailure("save", failed)),
});

/** Read and commit synchronously after opening the store: rapid taps must not
 * derive their next value from a stale rendered snapshot. */
export const AdjustCounter = Command.define("AdjustCounter", {
  args: { taskFieldId: Schema.String, delta: Schema.Literals([-1, 1]) },
  messages: [Message.UpdatedFieldValue, Message.FailedRunnerOp],
  execute: ({ taskFieldId, delta }) =>
    withStore((access) =>
      Effect.gen(function* () {
        const { store, tables, events } = access;
        const committedAt = yield* now;
        const field = store.query(tables.sessionTaskFields.select().where({ id: taskFieldId }))[0];
        if (
          field === undefined ||
          field.kind !== "counter" ||
          !isScalarAnswerValid("counter", field.value)
        )
          return Message.UpdatedFieldValue();
        if (!isPersistedFieldEditable(access, taskFieldId)) return Message.UpdatedFieldValue();
        const value = Number(field.value) + delta;
        if (value < 0 || !Number.isSafeInteger(value)) return Message.UpdatedFieldValue();
        store.commit(
          events.taskFieldValueChanged({ id: taskFieldId, value: String(value), now: committedAt }),
        );
        return Message.UpdatedFieldValue();
      }),
    ).pipe(serialized, reportFailure("save", failed)),
});

// ── RecordTask → taskFinished + taskSpawned ─────────────────────────────────

export const RecordTask = Command.define("RecordTask", {
  args: { sessionId: Schema.String, currentTaskId: Schema.String },
  messages: [Message.TaskRecorded, Message.FailedRunnerOp],
  execute: ({ sessionId, currentTaskId }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const endedAt = yield* now;
        // Recheck persisted completion: the model may have changed since dispatch.
        const taskRows = store.query(tables.sessionTasks.select().where({ sessionId }));
        const currentRow = Array.findFirst(taskRows, (r) => r.id === currentTaskId);
        if (Option.isNone(currentRow)) return failed("That task isn’t available any more.");
        // Guard: if task already finished, no-op
        if (currentRow.value.endDate !== null)
          return Message.TaskRecorded({ taskId: currentTaskId, fresh: false });

        const fieldRows = store.query(
          tables.sessionTaskFields
            .select()
            .where({ taskId: currentTaskId })
            .orderBy("sortOrder", "asc"),
        );
        // Recheck validity as well as requiredness against persisted values.
        if (Array.some(fieldRows, isIncomplete))
          return failed("Complete required questions and correct invalid answers first.");

        const nextOrder = Array.reduce(taskRows, 0, (max, r) => Math.max(max, r.orderIndex)) + 1;
        // The next task starts from the current task's questions and defaults.
        const nextFields = yield* withFreshIds(fieldRowsToDefs(fieldRows));
        const nextTaskId = yield* randomUuid;
        store.commit(
          events.taskFinished({ id: currentTaskId, endedAt }),
          events.taskSpawned({
            sessionId,
            id: nextTaskId,
            orderIndex: nextOrder,
            fields: nextFields,
          }),
        );
        return Message.TaskRecorded({ taskId: currentTaskId, fresh: true });
      }),
    ).pipe(serialized, reportFailure("record", failed)),
});

// ── EndSession → archive or delete then clear live graph, navigate ─────────

export const EndSession = Command.define("EndSession", {
  args: { sessionId: Schema.String },
  messages: [Message.SessionEnded, Message.FailedRunnerOp],
  execute: ({ sessionId }) =>
    withStore(({ store, tables, events }) =>
      Effect.gen(function* () {
        const endedAt = yield* now;
        const session = store.query(tables.sessions.select().where({ id: sessionId }))[0];
        if (session === undefined || session.endedAt !== null)
          return failed("This session has already ended.");

        const finished = Array.filter(
          store.query(
            tables.sessionTasks.select().where({ sessionId }).orderBy("orderIndex", "asc"),
          ),
          (task) => task.endDate !== null,
        );

        if (finished.length === 0) {
          // No tasks saved → delete live graph + session entirely
          store.commit(
            events.sessionLiveGraphCleared({ sessionId }),
            events.sessionDeleted({ id: sessionId }),
          );
          return Message.SessionEnded();
        }

        const records = [];
        for (const task of finished) {
          const fieldRows = store.query(
            tables.sessionTaskFields
              .select()
              .where({ taskId: task.id })
              .orderBy("sortOrder", "asc"),
          );
          if (Array.some(fieldRows, isIncomplete)) {
            return failed(
              `Open task ${task.orderIndex} and complete required questions and correct invalid answers, or cancel the edit first.`,
            );
          }
          records.push(archiveRecord(task, fieldRows));
        }

        // Archive order follows the live task list (queried by orderIndex).
        store.commit(
          events.sessionEnded({ id: sessionId, endedAt, records }),
          events.sessionLiveGraphCleared({ sessionId }),
        );
        return Message.SessionEnded();
      }),
    ).pipe(serialized, reportFailure("end", failed)),
});

// ── SelectTask → taskEditStarted / taskEditFinished ─────────────────────────

export const SelectTask = Command.define("SelectTask", {
  args: { sessionId: Schema.String, taskId: Schema.String },
  messages: [Message.TaskEditStarted, Message.TaskEditFinished, Message.FailedRunnerOp],
  execute: ({ sessionId, taskId }) =>
    withStore(({ store, tables, events }) =>
      Effect.sync(() => {
        const taskRows = store.query(tables.sessionTasks.select().where({ sessionId }));
        const target = Array.findFirst(taskRows, (r) => r.id === taskId);
        if (Option.isNone(target)) return Message.TaskEditStarted({ taskId });

        const edited = Array.findFirst(taskRows, (r) => r.isBeingEdited === 1);
        if (Option.isSome(edited) && edited.value.id !== taskId) {
          const fields = store.query(
            tables.sessionTaskFields.select().where({ taskId: edited.value.id }),
          );
          if (Array.some(fields, isIncomplete)) {
            return failed(
              "Complete required questions and correct invalid answers, or cancel the edit first.",
            );
          }
        }

        if (target.value.endDate !== null) {
          store.commit(events.taskEditStarted({ sessionId, id: taskId }));
          return Message.TaskEditStarted({ taskId });
        }
        // Selecting current (unfinished) → clear any editing
        if (Option.isSome(edited)) store.commit(events.taskEditFinished({ id: edited.value.id }));
        return Message.TaskEditFinished({ savedTaskId: null });
      }),
    ).pipe(serialized, reportFailure("load", failed)),
});

export const CancelEdit = Command.define("CancelEdit", {
  args: { taskId: Schema.String },
  messages: [Message.TaskEditFinished, Message.FailedRunnerOp],
  execute: ({ taskId }) =>
    withStore(({ store, events }) =>
      Effect.sync(() => {
        store.commit(events.taskEditCancelled({ id: taskId }));
        return Message.TaskEditFinished({ savedTaskId: null });
      }),
    ).pipe(serialized, reportFailure("save", failed)),
});

export const SaveEdit = Command.define("SaveEdit", {
  args: { taskId: Schema.String },
  messages: [Message.TaskEditFinished, Message.FailedRunnerOp],
  execute: ({ taskId }) =>
    withStore(({ store, tables, events }) =>
      Effect.sync(() => {
        const fieldRows = store.query(tables.sessionTaskFields.select().where({ taskId }));
        if (Array.some(fieldRows, isIncomplete))
          return failed("Complete required questions and correct invalid answers first.");
        store.commit(events.taskEditFinished({ id: taskId }));
        return Message.TaskEditFinished({ savedTaskId: taskId });
      }),
    ).pipe(serialized, reportFailure("save", failed)),
});
