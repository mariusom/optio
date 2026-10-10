// Plans transitions without storage or DOM effects; app/commands.ts executes emissions.

import { Match, Schema } from "effect";

import {
  RunnerDataSchema,
  currentTask,
  editableSection,
  findNextUnfulfilledSectionId,
  isSectionDone,
  isTaskDone,
  isTaskEditable,
  noFieldWrites,
  type RunnerData,
  type RunnerSection,
  type RunnerState,
  type RunnerTask,
} from "../../web/features/session/runner";

export type { RunnerData, RunnerState };

/**
 * Idle ⇔ `runner === null`. A live runner is either collecting answers or
 * confirming the end; `runner.showEndConfirm` is the single source of truth.
 */
export type SessionPhase = "collecting" | "confirming";

export const sessionPhase = (runner: RunnerState | null): SessionPhase =>
  runner?.showEndConfirm === true ? "confirming" : "collecting";

const SessionEvent = Schema.TaggedUnion({
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
  /** Typing paused, a field lost focus, or the page is being hidden or left. */
  FlushRequested: {},
});
export type SessionEvent = typeof SessionEvent.Type;

const SessionEmission = Schema.TaggedUnion({
  CommitFieldValues: {
    writes: Schema.Array(Schema.Struct({ taskFieldId: Schema.String, value: Schema.String })),
  },
  CommitCounterAdjustment: { taskFieldId: Schema.String, delta: Schema.Literals([-1, 1]) },
  CommitRecord: { sessionId: Schema.String, taskId: Schema.String },
  CommitSelectTask: { sessionId: Schema.String, taskId: Schema.String },
  CommitCancelEdit: { taskId: Schema.String },
  CommitSaveEdit: { taskId: Schema.String },
  CommitEndSession: { sessionId: Schema.String },
});
export type SessionEmission = typeof SessionEmission.Type;

export type SessionPlan = {
  readonly runner: RunnerState | null;
  readonly emissions: ReadonlyArray<SessionEmission>;
};

export type SessionPlanInput = Readonly<{
  runner: RunnerState | null;
  /**
   * Current Model time in ms. A plan that creates a runner from Idle stamps it
   * here, so the planner never reads the clock itself.
   */
  now: number;
}>;

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

const freshRunner = (data: RunnerData, now: number): RunnerState => ({
  ...data,
  focusedSectionId: null,
  showTaskList: false,
  showEndConfirm: false,
  showSidebar: true,
  lastError: null,
  now,
  fieldWrites: noFieldWrites,
});

const stay = (runner: RunnerState | null): SessionPlan => ({ runner, emissions: [] });

const next = (
  runner: RunnerState | null,
  ...emissions: ReadonlyArray<SessionEmission>
): SessionPlan => ({ runner, emissions });

const withCurrentTask = (runner: RunnerState, taskId: string | null): RunnerState => ({
  ...runner,
  currentTaskId: taskId ?? runner.currentTaskId,
});

// ── Field writes ─────────────────────────────────────────────────────────
//
// Typed answers update the runner at once but reach the store in batches:
// one write when typing pauses (see the fieldWriteFlush subscription), when
// the field loses focus, when the page is hidden or left, and before any
// command that reads persisted answers. A field's first write is dispatched
// immediately so its store `startDate` (COALESCE) is the first keystroke's
// time, not the flush time. Discrete choices are written immediately too.

/** Kinds answered by typing, whose writes wait for a pause. */
const isTypedKind = (kind: string): boolean =>
  kind === "textInput" || kind === "textArea" || kind === "number" || kind === "counter";

const withSectionValue = (
  runner: RunnerState,
  taskFieldId: string,
  value: string,
): RunnerState => ({
  ...runner,
  tasks: runner.tasks.map((task) =>
    task.sections.some((section) => section.id === taskFieldId)
      ? {
          ...task,
          sections: task.sections.map((section) =>
            section.id === taskFieldId
              ? { ...section, value, startDate: section.startDate ?? runner.now }
              : section,
          ),
        }
      : task,
  ),
});

/**
 * Dispatches the pending writes not dispatched yet. They stay in the overlay,
 * marked dispatched, until the store echoes them: an emission from an earlier
 * write must not revert what the field shows.
 */
const takeWrites = (runner: RunnerState): SessionPlan => {
  const { pending, revision } = runner.fieldWrites;
  const writes = pending
    .filter((write) => !write.committed)
    .map(({ taskFieldId, value }) => ({ taskFieldId, value }));
  if (writes.length === 0) return stay(runner);
  const dispatched = pending.map((write) => ({ ...write, committed: true }));
  return next(
    { ...runner, fieldWrites: { revision, pending: dispatched } },
    { _tag: "CommitFieldValues", writes },
  );
};

/**
 * Store rows can predate writes the runner already shows (a stale emission
 * while typing); pending answers win until they are written and echoed back.
 */
const syncPending = (
  runner: RunnerState,
  data: RunnerData,
): RunnerData & Pick<RunnerState, "fieldWrites"> => {
  const { pending, revision } = runner.fieldWrites;
  if (pending.length === 0) return { ...data, fieldWrites: runner.fieldWrites };
  const local = new Map<string, RunnerSection>();
  for (const task of runner.tasks)
    for (const section of task.sections) local.set(section.id, section);
  const byId = new Map(pending.map((write) => [write.taskFieldId, write]));
  // Stored value per field whose task still accepts answers; the store rejects
  // writes to other tasks, so their overlay is dropped.
  const stored = new Map<string, string>();
  const tasks = data.tasks.map((task) => ({
    ...task,
    sections: task.sections.map((section) => {
      if (isTaskEditable(task)) stored.set(section.id, section.value);
      const write = byId.get(section.id);
      if (write === undefined) return section;
      return {
        ...section,
        value: write.value,
        startDate: section.startDate ?? local.get(section.id)?.startDate ?? null,
      };
    }),
  }));
  // A dispatched write the store now reflects needs no further overlay.
  const remaining = pending.filter(
    (write) =>
      stored.has(write.taskFieldId) &&
      !(write.committed && stored.get(write.taskFieldId) === write.value),
  );
  return { ...data, tasks, fieldWrites: { revision, pending: remaining } };
};

/** Events that read or replace persisted answers write pending ones first. */
const flushesFirst = new Set<SessionEvent["_tag"]>([
  "FlushRequested",
  "CounterAdjusted",
  "RecordRequested",
  "TaskSelected",
  "EditCancelled",
  "EditSaved",
  "EndConfirmed",
]);

/** Events accepted in either live phase. */
const planLive = (runner: RunnerState, event: SessionEvent, now: number): SessionPlan | null =>
  Match.value(event).pipe(
    Match.tag("DataSynced", ({ data }) => {
      if (data === null) return next(null);
      if (data.sessionId !== runner.sessionId) return next(freshRunner(data, now));
      return next({ ...runner, ...syncPending(runner, data), now });
    }),
    Match.tag("SectionFocused", ({ fieldId }) =>
      runner.focusedSectionId === fieldId
        ? stay(runner)
        : next({ ...runner, focusedSectionId: fieldId }),
    ),
    Match.tag("TaskListToggled", () => next({ ...runner, showTaskList: !runner.showTaskList })),
    Match.tag("RecordAcked", () =>
      next({ ...runner, focusedSectionId: null, showTaskList: false, lastError: null }),
    ),
    Match.tag("EditAcked", () =>
      next({
        ...withCurrentTask(runner, fallbackTaskId(runner)),
        focusedSectionId: null,
        showTaskList: false,
        lastError: null,
      }),
    ),
    Match.tag("EndAcked", () => next(null)),
    Match.tag("FlushRequested", () => stay(runner)),
    Match.orElse(() => null),
  );

type EventOf<Tag extends SessionEvent["_tag"]> = Extract<SessionEvent, { _tag: Tag }>;
type PhaseHandlers = {
  readonly [Tag in SessionEvent["_tag"]]?: (
    runner: RunnerState,
    event: EventOf<Tag>,
  ) => SessionPlan;
};

/** Leaves edit mode and returns to the newest open task. */
const leaveEdit = (runner: RunnerState, emission: SessionEmission): SessionPlan =>
  next(
    {
      ...withCurrentTask(runner, fallbackTaskId(runner)),
      showTaskList: false,
      focusedSectionId: null,
    },
    emission,
  );

const collecting: PhaseHandlers = {
  CounterAdjusted: (runner, { taskFieldId, delta }) =>
    editableSection(runner, taskFieldId)?.kind === "counter"
      ? next(runner, { _tag: "CommitCounterAdjustment", taskFieldId, delta })
      : stay(runner),
  FieldChanged: (runner, { taskFieldId, value }) => {
    // A late input for a task that is no longer editable must not commit.
    const section = editableSection(runner, taskFieldId);
    if (section === null) return stay(runner);
    const focus = nextFocusForField(runner, taskFieldId, value);
    const dispatchNow = !isTypedKind(section.kind) || section.startDate === null;
    const { revision, pending } = runner.fieldWrites;
    const updated: RunnerState = {
      ...withSectionValue(runner, taskFieldId, value),
      focusedSectionId: focus.changed ? focus.next : runner.focusedSectionId,
      fieldWrites: {
        revision: revision + 1,
        pending: [
          ...pending.filter((write) => write.taskFieldId !== taskFieldId),
          { taskFieldId, value, committed: dispatchNow },
        ],
      },
    };
    return dispatchNow
      ? next(updated, { _tag: "CommitFieldValues", writes: [{ taskFieldId, value }] })
      : next(updated);
  },
  RecordRequested: (runner) => {
    const task = currentTask(runner);
    // Completed tasks are saved through the edit flow, never recorded again.
    // Check this before required fields so a stale selection is a quiet no-op.
    if (task === null || task.endDate !== null || task.isBeingEdited) return stay(runner);
    if (!isTaskDone(task)) {
      return next({ ...runner, lastError: "Answer the required questions before recording." });
    }
    return next(
      { ...runner, focusedSectionId: null, lastError: null },
      { _tag: "CommitRecord", sessionId: runner.sessionId, taskId: task.id },
    );
  },
  TaskSelected: (runner, { taskId }) => {
    if (!runner.tasks.some((t) => t.id === taskId)) return stay(runner);
    const editing = runner.tasks.find((t) => t.isBeingEdited);
    if (editing && editing.id !== taskId && !isTaskDone(editing)) {
      return next({
        ...runner,
        lastError:
          "Complete required questions and correct invalid answers, or cancel the edit first.",
      });
    }
    return next(
      { ...withCurrentTask(runner, taskId), focusedSectionId: null, showTaskList: false },
      { _tag: "CommitSelectTask", sessionId: runner.sessionId, taskId },
    );
  },
  EditCancelled: (runner) => {
    const editing = runner.tasks.find((t) => t.isBeingEdited);
    return editing === undefined
      ? stay(runner)
      : leaveEdit(runner, { _tag: "CommitCancelEdit", taskId: editing.id });
  },
  EditSaved: (runner) => {
    const editing = runner.tasks.find((t) => t.isBeingEdited);
    if (editing === undefined) return stay(runner);
    if (!isTaskDone(editing)) {
      return next({ ...runner, lastError: "Answer the required questions before saving." });
    }
    return leaveEdit(runner, { _tag: "CommitSaveEdit", taskId: editing.id });
  },
  EndRequested: (runner) => next({ ...runner, showEndConfirm: true }),
};

const planPhase = (handlers: PhaseHandlers, runner: RunnerState, event: SessionEvent) => {
  const handler = handlers[event._tag] as
    | ((runner: RunnerState, event: SessionEvent) => SessionPlan)
    | undefined;
  return handler === undefined ? stay(runner) : handler(runner, event);
};

const planCollecting = (runner: RunnerState, event: SessionEvent): SessionPlan =>
  planPhase(collecting, runner, event);

const planConfirming = (runner: RunnerState, event: SessionEvent): SessionPlan =>
  Match.value(event).pipe(
    Match.tag("EndCancelled", () => next({ ...runner, showEndConfirm: false })),
    // Confirmed: commit the end, return to collecting while the store
    // processes the archive (EndAcked → Idle afterwards).
    Match.tag("EndConfirmed", () =>
      next(
        { ...runner, showEndConfirm: false },
        { _tag: "CommitEndSession", sessionId: runner.sessionId },
      ),
    ),
    Match.orElse(() => stay(runner)),
  );

/**
 * Pure session reducer. Returns the input runner unchanged (same reference)
 * when an event does not apply, so callers can skip no-op model updates.
 */
export const planSession = (
  { runner, now }: SessionPlanInput,
  event: SessionEvent,
): SessionPlan => {
  if (runner === null) {
    return event._tag === "DataSynced" && event.data !== null
      ? next(freshRunner(event.data, now))
      : stay(null);
  }
  const flush = flushesFirst.has(event._tag) ? takeWrites(runner) : stay(runner);
  // `flush.runner` is non-null: takeWrites only clears the pending list.
  const current = flush.runner as RunnerState;
  const plan =
    planLive(current, event, now) ??
    (current.showEndConfirm ? planConfirming(current, event) : planCollecting(current, event));
  // Commands start in emission order and take the store write lock in that
  // order, so pending answers are written before the command that reads them.
  return flush.emissions.length === 0
    ? plan
    : { runner: plan.runner, emissions: [...flush.emissions, ...plan.emissions] };
};
