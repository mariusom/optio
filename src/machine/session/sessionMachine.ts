/**
 * Live-session state machine — schema-first, Effect v4, @typeonce/effect-machine.
 *
 * The live-session runner's control logic (task focus, record gating, task
 * edit lifecycle, end-session confirmation) used to be spread through
 * FoldKit's `update()` reducer in src/main.ts. It now lives here as a pure
 * statechart:
 *
 *   states   Idle → Live (compound: Collecting | ConfirmingEnd)
 *   events   UI messages + RunnerData store snapshots
 *   effects  SessionEmissions (Commit* protocol) → mapped to LiveStore
 *            commands by the adapter in src/machine/session/plan.ts.
 *
 * The machine never touches LiveStore or the DOM. `Machine.plan` plans
 * synchronously, so FoldKit's synchronous `update` drives it directly.
 */

import { Machine } from "@typeonce/effect-machine";
import { Schema } from "effect";

// ── Data schema (mirrors src/we/features/session/runner.ts RunnerData) ─────

const RunnerSectionSchema = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  name: Schema.String,
  kind: Schema.String,
  isRequired: Schema.Boolean,
  defaultValue: Schema.String,
  sortOrder: Schema.Number,
  options: Schema.Array(Schema.String),
  exclusiveOptions: Schema.Array(Schema.String),
  value: Schema.String,
  startDate: Schema.Union([Schema.Null, Schema.Number]),
});
export type RunnerSection = typeof RunnerSectionSchema.Type;

const RunnerTaskSchema = Schema.Struct({
  id: Schema.String,
  orderIndex: Schema.Number,
  endDate: Schema.Union([Schema.Null, Schema.Number]),
  isBeingEdited: Schema.Boolean,
  sections: Schema.Array(RunnerSectionSchema),
});
export type RunnerTask = typeof RunnerTaskSchema.Type;

const RunnerDataSchema = Schema.Struct({
  sessionId: Schema.String,
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  tasks: Schema.Array(RunnerTaskSchema),
  currentTaskId: Schema.Union([Schema.Null, Schema.String]),
  completedCount: Schema.Number,
});
export type RunnerData = typeof RunnerDataSchema.Type;

/** Value owned by the `Live` compound state (store data + control surface). */
const LiveValue = Schema.TaggedUnion({
  Live: {
    data: RunnerDataSchema,
    focusedSectionId: Schema.Union([Schema.Null, Schema.String]),
    showTaskList: Schema.Boolean,
    showSidebar: Schema.Boolean,
    lastError: Schema.Union([Schema.Null, Schema.String]),
    editBackup: Schema.Union([
      Schema.Null,
      Schema.Struct({ taskId: Schema.String, values: Schema.Record(Schema.String, Schema.String) }),
    ]),
  },
});
export type LiveValue = typeof LiveValue.Type;

// ── Topology ────────────────────────────────────────────────────────────────

export const SessionStates = Machine.state({
  initial: "Idle",
  states: {
    /** No live session (model.runner === null). */
    Idle: {},
    /** One live session; compound so the phases share data + control state. */
    Live: {
      schema: LiveValue.cases.Live,
      initial: "Collecting",
      states: {
        /** Normal recording flow (record gating, focus, task list, edits). */
        Collecting: {},
        /** "End session?" confirmation dialog open. */
        ConfirmingEnd: {},
      },
    },
  },
});

export type SessionPhase = "collecting" | "confirming";

// ── Events (public input protocol) ─────────────────────────────────────────

const SessionEvents = Machine.eventsFromSchemas(
  Schema.TaggedUnion({
    /** Store snapshot arrives (runner stream); null = session gone. */
    DataSynced: { data: Schema.Union([RunnerDataSchema, Schema.Null]) },
    /** A field value changed (radio/checkbox/text/textarea/boolean). */
    FieldChanged: { taskFieldId: Schema.String, value: Schema.String },
    /** User tapped a section (focus management). */
    SectionFocused: { fieldId: Schema.Union([Schema.Null, Schema.String]) },
    /** User tapped the Record button. */
    RecordRequested: {},
    /** User picked a task from the task list. */
    TaskSelected: { taskId: Schema.String },
    /** Toggle the task list sheet. */
    TaskListToggled: {},
    /** User tapped End session. */
    EndRequested: {},
    /** User cancelled the end-session confirmation. */
    EndCancelled: {},
    /** User confirmed ending the session. */
    EndConfirmed: {},
    /** User cancelled a task edit. */
    EditCancelled: {},
    /** User confirmed a task edit. */
    EditSaved: {},
    /** Store ack: a task was recorded (next task spawned). */
    RecordAcked: {},
    /** Store ack: edit finished (edit mode closed). */
    EditAcked: {},
    /** Store ack: session ended — machine returns to Idle. */
    EndAcked: {},
  }),
);
export type SessionEvent = Machine.EventOf<typeof SessionEvents>;

// ── Emissions (effects out → LiveStore commands via plan.ts) ───────────────

const SessionEmissions = Machine.emittedEventsFromSchemas(
  Schema.TaggedUnion({
    CommitFieldValue: { taskFieldId: Schema.String, value: Schema.String },
    CommitRecord: { sessionId: Schema.String, taskId: Schema.String },
    CommitSelectTask: { sessionId: Schema.String, taskId: Schema.String },
    CommitCancelEdit: {
      taskId: Schema.String,
      backup: Schema.Record(Schema.String, Schema.String),
    },
    CommitSaveEdit: { taskId: Schema.String },
    CommitEndSession: { sessionId: Schema.String },
  }),
);
export type SessionEmission = Machine.EventOf<typeof SessionEmissions>;

// ── Pure domain helpers ────────────────────────────────────────────────────

const isSectionDone = (section: RunnerSection): boolean =>
  section.isRequired ? section.value !== "" : true;

const isTaskDone = (task: RunnerTask): boolean => task.sections.every(isSectionDone);

const currentTask = (data: RunnerData): RunnerTask | null => {
  if (data.currentTaskId !== null) {
    const byId = data.tasks.find((t) => t.id === data.currentTaskId);
    if (byId !== undefined) return byId;
  }
  const edited = data.tasks.find((t) => t.isBeingEdited);
  if (edited !== undefined) return edited;
  const unfinished = [...data.tasks].filter((t) => t.endDate === null);
  if (unfinished.length > 0) {
    return unfinished.reduce((a, b) => (a.orderIndex > b.orderIndex ? a : b));
  }
  return data.tasks.length > 0 ? (data.tasks[data.tasks.length - 1] as RunnerTask) : null;
};

/** Newest unfinished task id — the target after finishing/cancelling an edit. */
const fallbackTaskId = (data: RunnerData): string | null => {
  const unfinished = [...data.tasks]
    .filter((t) => t.endDate === null)
    .sort((a, b) => b.orderIndex - a.orderIndex);
  return unfinished[0]?.id ?? null;
};

const findNextUnfulfilledSectionId = (
  sections: ReadonlyArray<RunnerSection>,
  currentSectionId: string,
): string | null => {
  const currentIndex = sections.findIndex((s) => s.id === currentSectionId);
  if (currentIndex === -1) return null;
  for (let i = currentIndex + 1; i < sections.length; i += 1) {
    const candidate = sections[i] as RunnerSection;
    if (!isSectionDone(candidate) || candidate.value === "") return candidate.id;
  }
  return null;
};

/**
 * Radio auto-advance: when a radio section becomes done, move focus to the
 * next unfulfilled section.
 * `changed: false` means "no auto-advance" (keep the current focus).
 */
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
  const sorted = [...base].sort((a, b) => a.sortOrder - b.sortOrder);
  const updatedSorted = sorted.map((s) => (s.id === taskFieldId ? { ...s, value } : s));
  return { changed: true, next: findNextUnfulfilledSectionId(updatedSorted, taskFieldId) };
};

/** Fresh Live value for a new session (every control reset). */
const freshLiveValue = (data: RunnerData): LiveValue => ({
  _tag: "Live",
  data,
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: true,
  lastError: null,
  editBackup: null,
});

/** The task field values captured so far (for the edit backup snapshot). */
const sectionValues = (task: RunnerTask): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const s of task.sections) values[s.id] = s.value;
  return values;
};

// ── Machine definition + handlers ──────────────────────────────────────────

const targets = Machine.targets(SessionStates);

export const SessionMachine = Machine.make({
  id: "Session",
  root: SessionStates,
  events: SessionEvents,
  emittedEvents: SessionEmissions,
  branches: {
    idleSync: {
      stay: { none: true },
      enter: { initial: targets.root.Live },
    },
    liveSync: {
      gone: { target: targets.root.Idle },
      fresh: { initial: targets.root.Live },
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
  states: {
    Idle: {
      on: {
        // Store says a session exists → enter Live with fresh controls.
        // No session (null) ⇒ stay Idle: entering a compound without an active
        // child is invalid and fails planning.
        DataSynced: {
          branches: "idleSync",
          resolve: ({ event, select }) =>
            event.data === null ? select.stay() : select.enter.decoded(freshLiveValue(event.data)),
        },
      },
    },

    // Shared behavior for both phases lives on the compound parent.
    Live: {
      on: {
        // Store snapshot refresh: gone → Idle, different session → fresh Live,
        // same session → keep controls, swap the data only.
        DataSynced: {
          branches: "liveSync",
          resolve: ({ event, state, select }) => {
            if (event.data === null) return select.gone.from();
            if (event.data.sessionId !== state.data.sessionId) {
              return select.fresh.decoded(freshLiveValue(event.data));
            }
            return select.same.decoded({ ...state, data: event.data });
          },
        },

        // Focus follows the tapped section (no topology change).
        SectionFocused: {
          update: targets.root.Live,
          decoded: ({ state: current, event }) => ({
            ...current,
            focusedSectionId: event.fieldId,
          }),
        },

        // Task list sheet toggle.
        TaskListToggled: {
          update: targets.root.Live,
          decoded: ({ state: current }) => ({
            ...current,
            showTaskList: !current.showTaskList,
          }),
        },

        // Store ack: task recorded → close focus/task list.
        RecordAcked: {
          update: targets.root.Live,
          decoded: ({ state: current }) => ({
            ...current,
            focusedSectionId: null,
            showTaskList: false,
          }),
        },

        // Store ack: edit finished → clear edit state, focus the newest open task.
        EditAcked: {
          update: targets.root.Live,
          decoded: ({ state: current }) => {
            const fallback = fallbackTaskId(current.data);
            return {
              ...current,
              editBackup: null,
              focusedSectionId: null,
              showTaskList: false,
              data: {
                ...current.data,
                currentTaskId: fallback ?? current.data.currentTaskId,
              },
            };
          },
        },

        // Store ack: session ended → back to Idle.
        EndAcked: { target: targets.root.Idle },
      },

      states: {
        Collecting: {
          on: {
            // Field edit: commit the value, radio auto-advances the focus.
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
                return select.live.decoded({
                  ...current,
                  focusedSectionId: fc.changed ? fc.next : current.focusedSectionId,
                });
              },
            },

            // Record the current task (gated on required fields).
            RecordRequested: {
              branches: "updateLive",
              resolve: ({ containingState: current, select }, enqueue) => {
                const cur = currentTask(current.data);
                if (cur === null) return select.live.decoded(current);
                // Completed tasks are saved through the edit flow, never recorded again.
                // Check this before required fields so a stale selection is a quiet no-op.
                if (cur.endDate !== null || cur.isBeingEdited) {
                  return select.live.decoded(current);
                }
                if (!isTaskDone(cur)) {
                  return select.live.decoded({
                    ...current,
                    lastError: "Answer the required questions before recording.",
                  });
                }
                enqueue.emit(
                  SessionEmissions.CommitRecord({
                    sessionId: current.data.sessionId,
                    taskId: cur.id,
                  }),
                );
                return select.live.decoded({ ...current, focusedSectionId: null });
              },
            },

            // Pick a task: finished → edit mode; open → just switch current task.
            TaskSelected: {
              branches: "updateLive",
              resolve: ({ containingState: current, event, select }, enqueue) => {
                const picked = current.data.tasks.find((t) => t.id === event.taskId);
                if (picked === undefined) return select.live.decoded(current);
                enqueue.emit(
                  SessionEmissions.CommitSelectTask({
                    sessionId: current.data.sessionId,
                    taskId: event.taskId,
                  }),
                );
                const data = { ...current.data, currentTaskId: event.taskId };
                const base: Omit<LiveValue, "data" | "editBackup"> = {
                  _tag: "Live",
                  focusedSectionId: null,
                  showTaskList: false,
                  showSidebar: current.showSidebar,
                  lastError: current.lastError,
                };
                const editBackup =
                  current.editBackup?.taskId === event.taskId
                    ? current.editBackup
                    : picked.endDate !== null
                      ? { taskId: event.taskId, values: sectionValues(picked) }
                      : null;
                return select.live.decoded({ ...base, data, editBackup });
              },
            },

            // Cancel a task edit: restore the backup via the store, go back to
            // the newest open task.
            EditCancelled: {
              branches: "updateLive",
              resolve: ({ containingState: current, select }, enqueue) => {
                const backup = current.editBackup;
                const editing = current.data.tasks.find((t) => t.isBeingEdited) ?? null;
                const fallback = fallbackTaskId(current.data);
                const common = {
                  showTaskList: false,
                  data: {
                    ...current.data,
                    currentTaskId: fallback ?? current.data.currentTaskId,
                  },
                };
                if (backup === null || editing === null) {
                  const targetId = editing?.id ?? backup?.taskId;
                  if (targetId !== undefined) {
                    enqueue.emit(
                      SessionEmissions.CommitCancelEdit({ taskId: targetId, backup: {} }),
                    );
                  }
                  return select.live.decoded({ ...current, ...common });
                }
                enqueue.emit(
                  SessionEmissions.CommitCancelEdit({
                    taskId: backup.taskId,
                    backup: backup.values,
                  }),
                );
                return select.live.decoded({
                  ...current,
                  ...common,
                  focusedSectionId: null,
                });
              },
            },

            // Save a task edit (gated on required fields).
            EditSaved: {
              branches: "updateLive",
              resolve: ({ containingState: current, select }, enqueue) => {
                const editing = current.data.tasks.find((t) => t.isBeingEdited) ?? null;
                if (editing === null) {
                  return select.live.decoded({ ...current, editBackup: null });
                }
                if (!isTaskDone(editing)) {
                  return select.live.decoded({
                    ...current,
                    lastError: "Answer the required questions before saving.",
                  });
                }
                const fallback = fallbackTaskId(current.data);
                enqueue.emit(SessionEmissions.CommitSaveEdit({ taskId: editing.id }));
                return select.live.decoded({
                  ...current,
                  showTaskList: false,
                  focusedSectionId: null,
                  data: {
                    ...current.data,
                    currentTaskId: fallback ?? current.data.currentTaskId,
                  },
                });
              },
            },

            // End-session confirmation opens.
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
                return select.collecting.from();
              },
            },
          },
        },
      },
    },
  },
});
