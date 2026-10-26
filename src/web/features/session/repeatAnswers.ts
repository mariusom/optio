import { Array, Order, pipe, String } from "effect";

import { isScalarAnswerValid } from "../../fields";
import { currentTask, type RunnerSection, type RunnerState, type RunnerTask } from "./runner";

// "Repeat last answers": fill the open task's unanswered questions with the
// previous recorded task's answers. Pure, so the planner and view agree.

type AnswerWrite = Readonly<{ taskFieldId: string; value: string }>;

export type RepeatPlan = Readonly<{
  /** The open task being filled. */
  task: RunnerTask;
  /** The newest recorded task before it; null when there is none. */
  source: RunnerTask | null;
  /** Answers to copy, in question order; empty when nothing can be filled. */
  writes: ReadonlyArray<AnswerWrite>;
}>;

/** Tasks share a template, so a question keeps its position, name and kind. */
const questionKey = (section: RunnerSection): string =>
  `${section.sortOrder}\u0000${section.kind}\u0000${section.name}`;

const bySortOrder = Order.mapInput(Order.Number, (section: RunnerSection) => section.sortOrder);

/** Choices must still exist; scalar answers must be valid for the kind. */
const fitsQuestion = (section: RunnerSection, value: string): boolean => {
  if (section.kind === "radio") return section.options.includes(value);
  if (section.kind === "checkbox")
    return Array.every(String.split(value, ","), (choice) => section.options.includes(choice));
  return isScalarAnswerValid(section.kind, value);
};

const previousRecordedTask = (runner: RunnerState, task: RunnerTask): RunnerTask | null =>
  pipe(
    runner.tasks,
    Array.filter((t) => t.endDate !== null && !t.isBeingEdited && t.orderIndex < task.orderIndex),
    Array.reduce<RunnerTask | null, RunnerTask>(null, (newest, t) =>
      newest === null || t.orderIndex > newest.orderIndex ? t : newest,
    ),
  );

/**
 * Copies only into questions never answered in this task (no first-write
 * time), so answers already given, including defaults the user kept after
 * touching them, are never overwritten.
 */
const fillWrites = (task: RunnerTask, source: RunnerTask): ReadonlyArray<AnswerWrite> => {
  const answers = new Map(
    Array.map(source.sections, (section) => [questionKey(section), section.value] as const),
  );
  return pipe(
    Array.sort(task.sections, bySortOrder),
    Array.flatMap((section): ReadonlyArray<AnswerWrite> => {
      const value = answers.get(questionKey(section));
      if (section.startDate !== null || value === undefined || value === "") return [];
      if (value === section.value || !fitsQuestion(section, value)) return [];
      return [{ taskFieldId: section.id, value }];
    }),
  );
};

/** Null unless the current task is open for recording (not a completed edit). */
export const repeatPlan = (runner: RunnerState): RepeatPlan | null => {
  const task = currentTask(runner);
  if (task === null || task.endDate !== null || task.isBeingEdited) return null;
  const source = previousRecordedTask(runner, task);
  return { task, source, writes: source === null ? [] : fillWrites(task, source) };
};
