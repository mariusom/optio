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

export const RunnerSectionSchema = Schema.Struct({
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

export const RunnerTaskSchema = Schema.Struct({
  id: Schema.String,
  orderIndex: Schema.Number,
  endDate: Schema.Union([Schema.Null, Schema.Number]),
  isBeingEdited: Schema.Boolean,
  sections: Schema.Array(RunnerSectionSchema),
});
export type RunnerTask = typeof RunnerTaskSchema.Type;

export const RunnerDataSchema = Schema.Struct({
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

export const SessionStates = Machine.states({
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
});

export type SessionPhase = "collecting" | "confirming";

// ── Events (public input protocol) ─────────────────────────────────────────

export const SessionEvents = Machine.events(
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
export type SessionEvent = typeof SessionEvents.Type;

// ── Emissions (effects out → LiveStore commands via plan.ts) ───────────────

export const SessionEmissions = Machine.emittedEvents(
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
export type SessionEmission = typeof SessionEmissions.Type;

// ── Pure domain helpers ────────────────────────────────────────────────────

export const isSectionDone = (section: RunnerSection): boolean =>
  section.isRequired ? section.value !== "" : true;

export const isTaskDone = (task: RunnerTask): boolean => task.sections.every(isSectionDone);

export const currentTask = (data: RunnerData): RunnerTask | null => {
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
export const fallbackTaskId = (data: RunnerData): string | null => {
  const unfinished = [...data.tasks]
    .filter((t) => t.endDate === null)
    .sort((a, b) => b.orderIndex - a.orderIndex);
  return unfinished[0]?.id ?? null;
};

export const findNextUnfulfilledSectionId = (
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
export const freshLiveValue = (data: RunnerData): LiveValue => ({
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

export const SessionMachine = Machine.make({
  id: "Session",
  states: SessionStates.states,
  events: SessionEvents,
  emittedEvents: SessionEmissions,
  initial: (to) => to.Idle(),
}).handle({
  Idle: {
    on: {
      // Store says a session exists → enter Live with fresh controls.
      DataSynced: (to) =>
        to.full
          .Live()
          .resolve(({ event, target }) =>
            event.data === null
              ? target.from()
              : target.from(freshLiveValue(event.data), (live) => live.Collecting.from()),
          ),
    },
  },

  // Shared behavior for both phases lives on the compound parent.
  Live: {
    on: {
      // Store snapshot refresh: gone → Idle, different session → fresh Live,
      // same session → keep controls, swap the data only.
      DataSynced: (to) =>
        to
          .branches({
            gone: { target: to.full.Idle() },
            fresh: { target: to.full.Live() },
            same: { target: to.local.update },
          })
          .resolve(({ event, snapshot, select }) => {
            if (event.data === null) return select.gone.from();
            const value = snapshot.value as LiveValue;
            if (event.data.sessionId !== value.data.sessionId) {
              return select.fresh.from(freshLiveValue(event.data), (live) =>
                live.Collecting.from(),
              );
            }
            return select.same.from({ ...value, data: event.data });
          }),

      // Focus follows the tapped section (no topology change).
      SectionFocused: (to) =>
        to.local.update(({ current, owner, event }) =>
          owner.from({ ...current, focusedSectionId: event.fieldId }),
        ),

      // Task list sheet toggle.
      TaskListToggled: (to) =>
        to.local.update(({ current, owner }) =>
          owner.from({ ...current, showTaskList: !current.showTaskList }),
        ),

      // Store ack: task recorded → close focus/task list.
      RecordAcked: (to) =>
        to.local.update(({ current, owner }) =>
          owner.from({ ...current, focusedSectionId: null, showTaskList: false }),
        ),

      // Store ack: edit finished → clear edit state, focus the newest open task.
      EditAcked: (to) =>
        to.local.update(({ current, owner }) => {
          const fallback = fallbackTaskId(current.data);
          return owner.from({
            ...current,
            editBackup: null,
            focusedSectionId: null,
            showTaskList: false,
            data: {
              ...current.data,
              currentTaskId: fallback ?? current.data.currentTaskId,
            },
          });
        }),

      // Store ack: session ended → back to Idle.
      EndAcked: (to) => to.full.Idle(),
    },

    states: {
      Collecting: {
        on: {
          // Field edit: commit the value, radio auto-advances the focus.
          FieldChanged: (to) =>
            to.local
              .Collecting()
              .updating(to.branch.Live)
              .resolve(({ current, target, owner, event }, enqueue) => {
                enqueue.emit(
                  SessionEmissions.CommitFieldValue({
                    taskFieldId: event.taskFieldId,
                    value: event.value,
                  }),
                );
                const fc = nextFocusForField(current.data, event.taskFieldId, event.value);
                return target.from().update(
                  owner.decoded({
                    ...current,
                    focusedSectionId: fc.changed ? fc.next : current.focusedSectionId,
                  }),
                );
              }),

          // Record the current task (gated on required fields).
          RecordRequested: (to) =>
            to.local
              .Collecting()
              .updating(to.branch.Live)
              .resolve(({ current, target, owner }, enqueue) => {
                const cur = currentTask(current.data);
                if (cur === null) return target.from().update(owner.decoded(current));
                if (!isTaskDone(cur)) {
                  return target.from().update(
                    owner.decoded({
                      ...current,
                      lastError: "Please complete required fields before recording.",
                    }),
                  );
                }
                enqueue.emit(
                  SessionEmissions.CommitRecord({
                    sessionId: current.data.sessionId,
                    taskId: cur.id,
                  }),
                );
                return target.from().update(owner.decoded({ ...current, focusedSectionId: null }));
              }),

          // Pick a task: finished → edit mode; open → just switch current task.
          TaskSelected: (to) =>
            to.local
              .Collecting()
              .updating(to.branch.Live)
              .resolve(({ current, target, owner, event }, enqueue) => {
                const picked = current.data.tasks.find((t) => t.id === event.taskId);
                if (picked === undefined) return target.from().update(owner.decoded(current));
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
                  picked.endDate !== null
                    ? { taskId: event.taskId, values: sectionValues(picked) }
                    : null;
                return target.from().update(owner.decoded({ ...base, data, editBackup }));
              }),

          // Cancel a task edit: restore the backup via the store, go back to
          // the newest open task.
          EditCancelled: (to) =>
            to.local
              .Collecting()
              .updating(to.branch.Live)
              .resolve(({ current, target, owner }, enqueue) => {
                const backup = current.editBackup;
                const editing = current.data.tasks.find((t) => t.isBeingEdited) ?? null;
                const fallback = fallbackTaskId(current.data);
                const common = {
                  editBackup: null,
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
                  return target.from().update(owner.decoded({ ...current, ...common }));
                }
                enqueue.emit(
                  SessionEmissions.CommitCancelEdit({
                    taskId: backup.taskId,
                    backup: backup.values,
                  }),
                );
                return target.from().update(
                  owner.decoded({
                    ...current,
                    ...common,
                    focusedSectionId: null,
                  }),
                );
              }),

          // Save a task edit (gated on required fields).
          EditSaved: (to) =>
            to.local
              .Collecting()
              .updating(to.branch.Live)
              .resolve(({ current, target, owner }, enqueue) => {
                const editing = current.data.tasks.find((t) => t.isBeingEdited) ?? null;
                if (editing === null) {
                  return target.from().update(owner.decoded({ ...current, editBackup: null }));
                }
                if (!isTaskDone(editing)) {
                  return target.from().update(
                    owner.decoded({
                      ...current,
                      lastError: "Please complete required fields before saving.",
                    }),
                  );
                }
                const fallback = fallbackTaskId(current.data);
                enqueue.emit(SessionEmissions.CommitSaveEdit({ taskId: editing.id }));
                return target.from().update(
                  owner.decoded({
                    ...current,
                    editBackup: null,
                    showTaskList: false,
                    focusedSectionId: null,
                    data: {
                      ...current.data,
                      currentTaskId: fallback ?? current.data.currentTaskId,
                    },
                  }),
                );
              }),

          // End-session confirmation opens.
          EndRequested: (to) => to.local.ConfirmingEnd(),
        },
      },

      ConfirmingEnd: {
        on: {
          EndCancelled: (to) => to.local.Collecting(),
          // Confirmed: commit the end, return to collecting while the store
          // processes the archive (EndAcked → Idle afterwards).
          EndConfirmed: (to) =>
            to.local.Collecting().resolve(({ snapshot }, enqueue) => {
              enqueue.emit(
                SessionEmissions.CommitEndSession({
                  sessionId: (snapshot.value as LiveValue).data.sessionId,
                }),
              );
            }),
        },
      },
    },
  },
});
