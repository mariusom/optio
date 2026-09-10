import { Schema } from "effect";

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

export const RunnerStateSchema = Schema.Struct({
  ...RunnerDataSchema.fields,
  focusedSectionId: Schema.Union([Schema.Null, Schema.String]),
  showTaskList: Schema.Boolean,
  showEndConfirm: Schema.Boolean,
  showSidebar: Schema.Boolean,
  lastError: Schema.Union([Schema.Null, Schema.String]),
  now: Schema.Number,
  editBackup: Schema.Union([
    Schema.Null,
    Schema.Struct({ taskId: Schema.String, values: Schema.Record(Schema.String, Schema.String) }),
  ]),
});
export type RunnerState = typeof RunnerStateSchema.Type;

// ── Section helpers ───────────────────────────────────────────────────────

export const isSectionDone = (section: RunnerSection): boolean =>
  section.isRequired ? section.value !== "" : true;

export const isTaskDone = (task: RunnerTask): boolean => task.sections.every(isSectionDone);

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
