// Runner pure helpers — mirrors Swift TaskSection/Task/SessionManager semantics
// Spec §1.5, §1.6, §2, §4

export type RunnerSection = {
  readonly id: string;
  readonly taskId: string;
  readonly name: string;
  readonly kind: string;
  readonly isRequired: boolean;
  readonly defaultValue: string;
  readonly sortOrder: number;
  readonly options: ReadonlyArray<string>;
  readonly exclusiveOptions: ReadonlyArray<string>;
  readonly value: string;
  readonly startDate: number | null;
};

export type RunnerTask = {
  readonly id: string;
  readonly orderIndex: number;
  readonly endDate: number | null;
  readonly isBeingEdited: boolean;
  readonly sections: ReadonlyArray<RunnerSection>;
};

export type RunnerData = {
  readonly sessionId: string;
  readonly templateName: string;
  readonly sessionName: string;
  readonly startedAt: number;
  readonly tasks: ReadonlyArray<RunnerTask>;
  readonly currentTaskId: string | null;
  readonly completedCount: number;
};

export type RunnerState = RunnerData & {
  readonly focusedSectionId: string | null;
  readonly showTaskList: boolean;
  readonly showEndConfirm: boolean;
  readonly lastError: string | null;
  readonly now: number;
  readonly editBackup: { readonly taskId: string; readonly values: Record<string, string> } | null;
};

// ── Section helpers ───────────────────────────────────────────────────────

export const isSectionDone = (section: RunnerSection): boolean =>
  section.isRequired ? section.value !== "" : true;

export const isTaskDone = (task: RunnerTask): boolean => task.sections.every(isSectionDone);

export const canRecordTask = (task: RunnerTask | null | undefined): boolean =>
  task !== null && task !== undefined && isTaskDone(task);

// Task state mirrors Swift TaskState enum
export type TaskState = "current" | "editable" | "done";

export const taskState = (task: RunnerTask): TaskState => {
  if (task.endDate === null || task.endDate === undefined) return "current";
  return task.isBeingEdited ? "editable" : "done";
};

export const isTaskEditable = (task: RunnerTask): boolean => taskState(task) === "editable";

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

export const isEditing = (runner: RunnerData | RunnerState): boolean => {
  const cur = currentTask(runner);
  return cur !== null && cur.isBeingEdited;
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
export { toggleCheckboxOption } from "../../fields";
