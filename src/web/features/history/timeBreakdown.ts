// Pure "where did the time go?" summary for one archived session: task time
// grouped by the answer each single-choice or yes/no question received.

import { formatAnswer } from "./helpers";

type BreakdownTask = {
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly sections: ReadonlyArray<{
    readonly sectionName: string;
    readonly value: string;
    readonly sectionType: string;
  }>;
};

/** One bucket of a question's time. `slot` is its categorical colour (0-based). */
export type BreakdownSegment = {
  readonly key: string;
  readonly label: string;
  readonly kind: "answer" | "other" | "unanswered";
  readonly durationMs: number;
  readonly share: number;
  /** Whole percent; a question's segments always total 100. */
  readonly percent: number;
  readonly slot: number | null;
};

export type QuestionBreakdown = {
  readonly key: string;
  readonly question: string;
  readonly totalMs: number;
  readonly segments: ReadonlyArray<BreakdownSegment>;
};

/** Answers shown by name before the rest fold into "Other". */
const MAX_NAMED_ANSWERS = 5;

const BREAKDOWN_TYPES = new Set(["radio", "boolean"]);

type Tally = {
  key: string;
  question: string;
  sectionType: string;
  byAnswer: Map<string, number>;
  unansweredMs: number;
};

const answerLabel = (sectionType: string, value: string): string | null =>
  value.trim() === "" ? null : formatAnswer(sectionType, value.trim());

const taskDuration = (task: BreakdownTask): number | null =>
  task.startedAt === null || task.endedAt === null
    ? null
    : Math.max(0, task.endedAt - task.startedAt);

/**
 * Questions are keyed by name and occurrence, like CSV columns, so two
 * questions sharing a name stay separate.
 */
const tallyTasks = (tasks: ReadonlyArray<BreakdownTask>): ReadonlyArray<Tally> => {
  const tallies = new Map<string, Tally>();
  for (const task of tasks) {
    const durationMs = taskDuration(task);
    if (durationMs === null) continue;
    const occurrences = new Map<string, number>();
    for (const section of task.sections) {
      const occurrence = occurrences.get(section.sectionName) ?? 0;
      occurrences.set(section.sectionName, occurrence + 1);
      if (!BREAKDOWN_TYPES.has(section.sectionType)) continue;
      const key = `${section.sectionName}#${occurrence}`;
      const tally = tallies.get(key) ?? {
        key,
        question: section.sectionName,
        sectionType: section.sectionType,
        byAnswer: new Map<string, number>(),
        unansweredMs: 0,
      };
      tallies.set(key, tally);
      const label = answerLabel(section.sectionType, section.value);
      if (label === null) tally.unansweredMs += durationMs;
      else tally.byAnswer.set(label, (tally.byAnswer.get(label) ?? 0) + durationMs);
    }
  }
  return [...tallies.values()];
};

/** Yes before No; otherwise the most time first, then by name. */
const orderedAnswers = (tally: Tally): Array<[string, number]> => {
  const entries = [...tally.byAnswer.entries()];
  if (tally.sectionType === "boolean") {
    return entries.toSorted(([a], [b]) => (a === b ? 0 : a === "Yes" ? -1 : 1));
  }
  return entries.toSorted(
    ([aLabel, aMs], [bLabel, bMs]) => bMs - aMs || aLabel.localeCompare(bLabel),
  );
};

/**
 * Largest-remainder rounding: floor every share, then give the leftover
 * points to the largest remainders, so the percents total exactly 100.
 */
export const wholePercents = (shares: ReadonlyArray<number>): ReadonlyArray<number> => {
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return shares.map(() => 0);
  const exact = shares.map((share) => (share / total) * 100);
  const floors = exact.map(Math.floor);
  const leftover = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - floors[index]! }))
    .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index);
  const bonus = new Set(byRemainder.slice(0, leftover).map(({ index }) => index));
  return floors.map((value, index) => value + (bonus.has(index) ? 1 : 0));
};

const withPercents = (
  segments: ReadonlyArray<Omit<BreakdownSegment, "percent">>,
): ReadonlyArray<BreakdownSegment> => {
  const percents = wholePercents(segments.map((segment) => segment.share));
  return segments.map((segment, index) => ({ ...segment, percent: percents[index]! }));
};

const toBreakdown = (tally: Tally): QuestionBreakdown => {
  const answers = orderedAnswers(tally);
  // Folding a single answer into "Other" would only hide its name.
  const named =
    answers.length > MAX_NAMED_ANSWERS + 1 ? answers.slice(0, MAX_NAMED_ANSWERS) : answers;
  const otherMs = answers.slice(named.length).reduce((sum, [, ms]) => sum + ms, 0);
  const answeredMs = answers.reduce((sum, [, ms]) => sum + ms, 0);
  const totalMs = answeredMs + tally.unansweredMs;
  const segment = (
    fields: Omit<BreakdownSegment, "share" | "percent">,
  ): Omit<BreakdownSegment, "percent"> => ({
    ...fields,
    share: totalMs === 0 ? 0 : fields.durationMs / totalMs,
  });
  return {
    key: tally.key,
    question: tally.question,
    totalMs,
    segments: withPercents([
      ...named.map(([label, durationMs], slot) =>
        segment({ key: `answer:${label}`, label, kind: "answer", durationMs, slot }),
      ),
      ...(named.length === answers.length
        ? []
        : [
            segment({
              key: "other",
              label: "Other",
              kind: "other",
              durationMs: otherMs,
              slot: MAX_NAMED_ANSWERS,
            }),
          ]),
      ...(tally.unansweredMs === 0
        ? []
        : [
            segment({
              key: "unanswered",
              label: "Unanswered",
              kind: "unanswered",
              durationMs: tally.unansweredMs,
              slot: null,
            }),
          ]),
    ]),
  };
};

/**
 * Task time per answer for each single-choice and yes/no question that was
 * answered at least once, in question order. Tasks without both a start and
 * an end are left out; unanswered time is its own bucket.
 */
export const timeBreakdown = (
  tasks: ReadonlyArray<BreakdownTask>,
): ReadonlyArray<QuestionBreakdown> =>
  tallyTasks(tasks)
    .filter((tally) => tally.byAnswer.size > 0)
    .map(toBreakdown)
    .filter((breakdown) => breakdown.totalMs > 0);

/** "45%", "<1%" for a sliver, so no visible share reads as zero. */
export const formatShare = (segment: Pick<BreakdownSegment, "share" | "percent">): string => {
  if (segment.share <= 0) return "0%";
  return segment.percent === 0 ? "<1%" : `${segment.percent}%`;
};
