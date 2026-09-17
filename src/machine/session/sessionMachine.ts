// Plans transitions without storage or DOM effects; app/commands.ts executes emissions.

import { Machine } from "@typeonce/effect-machine";
import { Schema } from "effect";

import {
  RunnerDataSchema,
  currentTask,
  findNextUnfulfilledSectionId,
  isSectionDone,
  isTaskDone,
  type RunnerData,
  type RunnerSection,
  type RunnerTask,
} from "../../web/features/session/runner";

export type { RunnerData, RunnerSection, RunnerTask } from "../../web/features/session/runner";

const LiveValue = Schema.TaggedUnion({
  Live: {
    data: RunnerDataSchema,
    focusedSectionId: Schema.Union([Schema.Null, Schema.String]),
    showTaskList: Schema.Boolean,
    showSidebar: Schema.Boolean,
    lastError: Schema.Union([Schema.Null, Schema.String]),
  },
});
export type LiveValue = typeof LiveValue.Type;

export const SessionStates = Machine.state({
  states: {
    Idle: {},
    Live: {
      schema: LiveValue.cases.Live,
      states: {
        Collecting: {},
        ConfirmingEnd: {},
      },
    },
  },
});

export type SessionPhase = "collecting" | "confirming";

const SessionEvents = Machine.eventsFromSchemas(
  Schema.TaggedUnion({
    /** Null means the live session no longer exists. */
    DataSynced: { data: Schema.Union([RunnerDataSchema, Schema.Null]) },
    FieldChanged: { taskFieldId: Schema.String, value: Schema.String },
    CounterAdjusted: { taskFieldId: Schema.String, delta: Schema.Literals([-1, 1]) },
    SectionFocused: { fieldId: Schema.Union([Schema.Null, Schema.String]) },
    RecordRequested: {},
    TaskSelected: { taskId: Schema.String },
    TaskListToggled: {},
    EndRequested: {},
    EndCancelled: {},
    EndConfirmed: {},
    EditCancelled: {},
    EditSaved: {},
    RecordAcked: {},
    EditAcked: {},
    EndAcked: {},
  }),
);
export type SessionEvent = Machine.EventOf<typeof SessionEvents>;

const SessionEmissions = Machine.emittedEventsFromSchemas(
  Schema.TaggedUnion({
    CommitFieldValue: { taskFieldId: Schema.String, value: Schema.String },
    CommitCounterAdjustment: { taskFieldId: Schema.String, delta: Schema.Literals([-1, 1]) },
    CommitRecord: { sessionId: Schema.String, taskId: Schema.String },
    CommitSelectTask: { sessionId: Schema.String, taskId: Schema.String },
    CommitCancelEdit: {
      taskId: Schema.String,
    },
    CommitSaveEdit: { taskId: Schema.String },
    CommitEndSession: { sessionId: Schema.String },
  }),
);
export type SessionEmission = Machine.EventOf<typeof SessionEmissions>;

/** Newest unfinished task id — the target after finishing/cancelling an edit. */
const fallbackTaskId = (data: RunnerData): string | null => {
  const unfinished = data.tasks
    .filter((t) => t.endDate === null)
    .toSorted((a, b) => b.orderIndex - a.orderIndex);
  return unfinished[0]?.id ?? null;
};

/** `changed: false` preserves focus; `changed: true, next: null` clears it. */
export const nextFocusForField = (
  data: RunnerData,
  taskFieldId: string,
  value: string,
): { changed: boolean; next: string | null } => {
  let targetSection: RunnerSection | null = null;
  let targetTask: RunnerTask | null = null;
  for (const t of data.tasks) {
    const s = t.sections.find((sec) => sec.id === taskFieldId);
    if (s !== undefined) {
      targetSection = s;
      targetTask = t;
      break;
    }
  }
  if (targetSection === null || targetTask === null) return { changed: false, next: null };
  if (targetSection.kind !== "radio") return { changed: false, next: null };
  const updated: RunnerSection = { ...targetSection, value };
  if (!isSectionDone(updated)) return { changed: false, next: null };
  const base = (currentTask(data) ?? targetTask).sections;
  const sorted = base.toSorted((a, b) => a.sortOrder - b.sortOrder);
  const updatedSorted = sorted.map((s) => (s.id === taskFieldId ? { ...s, value } : s));
  return { changed: true, next: findNextUnfulfilledSectionId(updatedSorted, taskFieldId) };
};

const freshLiveValue = (data: RunnerData): LiveValue => ({
  _tag: "Live",
  data,
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: true,
  lastError: null,
});

const targets = Machine.targets(SessionStates);

export const SessionMachine = Machine.make({
  id: "Session",
  root: SessionStates,
  events: SessionEvents,
  emittedEvents: SessionEmissions,
  branches: {
    idleSync: {
      stay: { none: true },
      enter: { target: targets.root.Live },
    },
    liveSync: {
      gone: { target: targets.root.Idle },
      fresh: { target: targets.root.Live },
      same: { update: targets.root.Live },
    },
    updateLive: {
      live: { update: targets.root.Live },
    },
    finishConfirmation: {
      collecting: { target: targets.root.Live.Collecting },
    },
  },
}).handle({
  initial: { target: targets.root.Idle },
  states: {
    Idle: {
      on: {
        // No session (null) ⇒ stay Idle: entering a compound without an active
        // child is invalid and fails planning.
        DataSynced: {
          branches: "idleSync",
          resolve: ({ event, select }) =>
            event.data === null
              ? select.stay()
              : select.enter({ decoded: true, data: freshLiveValue(event.data) }),
        },
      },
    },

    Live: {
      initial: { target: targets.root.Live.Collecting },
      on: {
        DataSynced: {
          branches: "liveSync",
          resolve: ({ event, state, select }) => {
            if (event.data === null) return select.gone();
            if (event.data.sessionId !== state.data.sessionId) {
              return select.fresh({ decoded: true, data: freshLiveValue(event.data) });
            }
            return select.same({ decoded: true, data: { ...state, data: event.data } });
          },
        },

        SectionFocused: {
          update: targets.root.Live,
          decoded: true,
          data: ({ state: current, event }) => ({
            ...current,
            focusedSectionId: event.fieldId,
          }),
        },

        TaskListToggled: {
          update: targets.root.Live,
          decoded: true,
          data: ({ state: current }) => ({
            ...current,
            showTaskList: !current.showTaskList,
          }),
        },

        RecordAcked: {
          update: targets.root.Live,
          decoded: true,
          data: ({ state: current }) => ({
            ...current,
            focusedSectionId: null,
            showTaskList: false,
          }),
        },

        EditAcked: {
          update: targets.root.Live,
          decoded: true,
          data: ({ state: current }) => {
            const fallback = fallbackTaskId(current.data);
            return {
              ...current,
              focusedSectionId: null,
              showTaskList: false,
              data: {
                ...current.data,
                currentTaskId: fallback ?? current.data.currentTaskId,
              },
            };
          },
        },

        EndAcked: { target: targets.root.Idle },
      },

      states: {
        Collecting: {
          on: {
            CounterAdjusted: {
              branches: "updateLive",
              resolve: ({ containingState: current, event, select }, enqueue) => {
                const task = currentTask(current.data);
                if (
                  task &&
                  (task.endDate === null || task.isBeingEdited) &&
                  task.sections.some(
                    (field) => field.id === event.taskFieldId && field.kind === "counter",
                  )
                ) {
                  enqueue.emit(
                    SessionEmissions.CommitCounterAdjustment({
                      taskFieldId: event.taskFieldId,
                      delta: event.delta,
                    }),
                  );
                }
                return select.live({ decoded: true, data: current });
              },
            },
            FieldChanged: {
              branches: "updateLive",
              resolve: ({ containingState: current, event, select }, enqueue) => {
                enqueue.emit(
                  SessionEmissions.CommitFieldValue({
                    taskFieldId: event.taskFieldId,
                    value: event.value,
                  }),
                );
                const fc = nextFocusForField(current.data, event.taskFieldId, event.value);
                return select.live({
                  decoded: true,
                  data: {
                    ...current,
                    focusedSectionId: fc.changed ? fc.next : current.focusedSectionId,
                  },
                });
              },
            },

            RecordRequested: {
              branches: "updateLive",
              resolve: ({ containingState: current, select }, enqueue) => {
                const cur = currentTask(current.data);
                if (cur === null) return select.live({ decoded: true, data: current });
                // Completed tasks are saved through the edit flow, never recorded again.
                // Check this before required fields so a stale selection is a quiet no-op.
                if (cur.endDate !== null || cur.isBeingEdited) {
                  return select.live({ decoded: true, data: current });
                }
                if (!isTaskDone(cur)) {
                  return select.live({
                    decoded: true,
                    data: {
                      ...current,
                      lastError: "Answer the required questions before recording.",
                    },
                  });
                }
                enqueue.emit(
                  SessionEmissions.CommitRecord({
                    sessionId: current.data.sessionId,
                    taskId: cur.id,
                  }),
                );
                return select.live({
                  decoded: true,
                  data: { ...current, focusedSectionId: null },
                });
              },
            },

            TaskSelected: {
              branches: "updateLive",
              resolve: ({ containingState: current, event, select }, enqueue) => {
                const picked = current.data.tasks.find((t) => t.id === event.taskId);
                if (picked === undefined) return select.live({ decoded: true, data: current });
                const editing = current.data.tasks.find((t) => t.isBeingEdited);
                if (editing && editing.id !== event.taskId && !isTaskDone(editing)) {
                  return select.live({
                    decoded: true,
                    data: {
                      ...current,
                      lastError:
                        "Complete required questions and correct invalid answers, or cancel the edit first.",
                    },
                  });
                }
                enqueue.emit(
                  SessionEmissions.CommitSelectTask({
                    sessionId: current.data.sessionId,
                    taskId: event.taskId,
                  }),
                );
                const data = { ...current.data, currentTaskId: event.taskId };
                return select.live({
                  decoded: true,
                  data: {
                    ...current,
                    data,
                    focusedSectionId: null,
                    showTaskList: false,
                  },
                });
              },
            },

            EditCancelled: {
              branches: "updateLive",
              resolve: ({ containingState: current, select }, enqueue) => {
                const editing = current.data.tasks.find((t) => t.isBeingEdited) ?? null;
                if (editing === null) return select.live({ decoded: true, data: current });
                const fallback = fallbackTaskId(current.data);
                enqueue.emit(SessionEmissions.CommitCancelEdit({ taskId: editing.id }));
                return select.live({
                  decoded: true,
                  data: {
                    ...current,
                    showTaskList: false,
                    data: {
                      ...current.data,
                      currentTaskId: fallback ?? current.data.currentTaskId,
                    },
                    focusedSectionId: null,
                  },
                });
              },
            },

            EditSaved: {
              branches: "updateLive",
              resolve: ({ containingState: current, select }, enqueue) => {
                const editing = current.data.tasks.find((t) => t.isBeingEdited) ?? null;
                if (editing === null) {
                  return select.live({ decoded: true, data: current });
                }
                if (!isTaskDone(editing)) {
                  return select.live({
                    decoded: true,
                    data: {
                      ...current,
                      lastError: "Answer the required questions before saving.",
                    },
                  });
                }
                const fallback = fallbackTaskId(current.data);
                enqueue.emit(SessionEmissions.CommitSaveEdit({ taskId: editing.id }));
                return select.live({
                  decoded: true,
                  data: {
                    ...current,
                    showTaskList: false,
                    focusedSectionId: null,
                    data: {
                      ...current.data,
                      currentTaskId: fallback ?? current.data.currentTaskId,
                    },
                  },
                });
              },
            },

            EndRequested: { target: targets.root.Live.ConfirmingEnd },
          },
        },

        ConfirmingEnd: {
          on: {
            EndCancelled: { target: targets.root.Live.Collecting },
            // Confirmed: commit the end, return to collecting while the store
            // processes the archive (EndAcked → Idle afterwards).
            EndConfirmed: {
              branches: "finishConfirmation",
              resolve: ({ containingState, select }, enqueue) => {
                enqueue.emit(
                  SessionEmissions.CommitEndSession({
                    sessionId: containingState.data.sessionId,
                  }),
                );
                return select.collecting();
              },
            },
          },
        },
      },
    },
  },
});
