import { Schema } from "effect";
import { isScalarAnswerValid } from "../../fields";

// Shared runner contracts and pure task/section/session semantics.
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

/**
 * A typed answer held in the Model until it is written. `committed` marks a
 * value whose write was already dispatched (a first answer, or a discrete
 * choice), so the next flush can skip it.
 */
const PendingWriteSchema = Schema.Struct({
  taskFieldId: Schema.String,
  value: Schema.String,
  committed: Schema.Boolean,
});

/** Unwritten answers, and a revision that changes with every keystroke. */
const FieldWritesSchema = Schema.Struct({
  revision: Schema.Number,
  pending: Schema.Array(PendingWriteSchema),
});
export type FieldWrites = typeof FieldWritesSchema.Type;

export const noFieldWrites: FieldWrites = { revision: 0, pending: [] };

/**
 * A short confirmation for the runner's polite status region ("Task 3
 * recorded"). It stays until the next answer change or task action.
 */
const RunnerAnnouncementSchema = Schema.Struct({
  kind: Schema.Literals(["recorded", "filled"]),
  text: Schema.String,
});
export type RunnerAnnouncement = typeof RunnerAnnouncementSchema.Type;

export const RunnerStateSchema = Schema.Struct({
  ...RunnerDataSchema.fields,
  focusedSectionId: Schema.Union([Schema.Null, Schema.String]),
  showTaskList: Schema.Boolean,
  showEndConfirm: Schema.Boolean,
  showSidebar: Schema.Boolean,
  lastError: Schema.Union([Schema.Null, Schema.String]),
  now: Schema.Number,
  fieldWrites: FieldWritesSchema,
  announcement: Schema.NullOr(RunnerAnnouncementSchema),
});
export type RunnerState = typeof RunnerStateSchema.Type;

// ── Section helpers ───────────────────────────────────────────────────────

/** A valid answer, and not empty when the question is required. */
export const isAnswerComplete = (answer: {
  readonly kind: string;
  readonly value: string;
  readonly isRequired: boolean;
}): boolean =>
  isScalarAnswerValid(answer.kind, answer.value) && (!answer.isRequired || answer.value !== "");

export const isSectionDone = (section: RunnerSection): boolean => isAnswerComplete(section);

export const isTaskDone = (task: RunnerTask): boolean => task.sections.every(isSectionDone);

/** Open tasks and completed tasks in edit mode accept answer changes. */
export const isTaskEditable = (task: {
  readonly endDate: unknown;
  readonly isBeingEdited: boolean;
}): boolean => task.endDate === null || task.isBeingEdited;

/** The section with this id, if its task currently accepts answer changes. */
export const editableSection = (
  runner: Pick<RunnerData, "tasks">,
  taskFieldId: string,
): RunnerSection | null => {
  for (const task of runner.tasks) {
    const section = task.sections.find((candidate) => candidate.id === taskFieldId);
    if (section !== undefined) return isTaskEditable(task) ? section : null;
  }
  return null;
};

export const canRecordTask = (task: RunnerTask | null | undefined): boolean =>
  task !== null &&
  task !== undefined &&
  task.endDate === null &&
  !task.isBeingEdited &&
  isTaskDone(task);

// Earliest touched section startDate (min) — mirrors Task.startDate
export const taskStartDate = (task: RunnerTask): number | null => {
  const starts = task.sections.map((s) => s.startDate).filter((v): v is number => v !== null);
  if (starts.length === 0) return null;
  return Math.min(...starts);
};

// Derive current task from runner (prefers editing task, else unfinished)
export const currentTask = (runner: RunnerData | RunnerState): RunnerTask | null => {
  if (runner.currentTaskId !== null) {
    const byId = runner.tasks.find((t) => t.id === runner.currentTaskId);
    if (byId !== undefined) return byId;
  }
  // Fallback: prefer edited, else unfinished with max orderIndex, else last
  const edited = runner.tasks.find((t) => t.isBeingEdited);
  if (edited !== undefined) return edited;
  const unfinished = [...runner.tasks].filter((t) => t.endDate === null);
  if (unfinished.length > 0) {
    return unfinished.reduce((a, b) => (a.orderIndex > b.orderIndex ? a : b));
  }
  return runner.tasks.length > 0 ? (runner.tasks[runner.tasks.length - 1] as RunnerTask) : null;
};

// Find next unfulfilled section after current index (radio auto-advance)
// Mirrors FormSectionContent.findNextUnfulfilledSection logic
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

// Checkbox semantics re-export for runner tests (uses fields.toggleCheckboxOption)
