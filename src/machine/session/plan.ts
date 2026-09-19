/**
 * FoldKit needs synchronous updates. Machine.plan requires decoded schema
 * instances, so translate the plain runner state through decodeSnapshot first.
 */

import { Effect } from "effect";
import { Machine } from "@typeonce/effect-machine";

import type { RunnerState } from "../../web/features/session/runner";
import {
  SessionMachine,
  type LiveValue,
  type SessionEmission,
  type SessionEvent,
  type SessionPhase,
} from "./sessionMachine";

export type { RunnerState, SessionEmission };

const phaseToChildPath = (phase: SessionPhase): "Live.Collecting" | "Live.ConfirmingEnd" =>
  phase === "confirming" ? "Live.ConfirmingEnd" : "Live.Collecting";

const childPathToPhase = (childPath: string): SessionPhase =>
  childPath === "Live.ConfirmingEnd" ? "confirming" : "collecting";

const runnerToValue = (runner: RunnerState): LiveValue => ({
  _tag: "Live",
  data: {
    sessionId: runner.sessionId,
    templateName: runner.templateName,
    sessionName: runner.sessionName,
    startedAt: runner.startedAt,
    tasks: runner.tasks,
    currentTaskId: runner.currentTaskId,
    completedCount: runner.completedCount,
  },
  focusedSectionId: runner.focusedSectionId,
  showTaskList: runner.showTaskList,
  showSidebar: runner.showSidebar,
  lastError: runner.lastError,
});

const toEncoded = (runner: RunnerState | null, phase: SessionPhase) =>
  runner === null
    ? {
        _tag: "MachineSnapshot" as const,
        version: 2 as const,
        active: [{ path: "" as const }, { path: "Idle" as const }],
      }
    : {
        _tag: "MachineSnapshot" as const,
        version: 2 as const,
        active: [
          { path: "" as const },
          { path: "Live" as const, value: runnerToValue(runner) },
          { path: phaseToChildPath(phase) },
        ],
      };

const snapshotToRunner = (
  root: { path: string; state?: { path: string; value?: unknown; state?: { path: string } } },
  now: number,
): { runner: RunnerState | null; phase: SessionPhase } => {
  const next = root.state as { path: string; value?: unknown; state?: { path: string } };
  if (next.path === "Idle") return { runner: null, phase: "collecting" };
  const value = next.value as LiveValue;
  const phase = childPathToPhase((next.state as { path: string }).path);
  return {
    phase,
    runner: {
      ...value.data,
      focusedSectionId: value.focusedSectionId,
      showTaskList: value.showTaskList,
      showSidebar: value.showSidebar,
      lastError: value.lastError,
      now,
      showEndConfirm: phase === "confirming",
    },
  };
};

export type SessionPlan = {
  readonly runner: RunnerState | null;
  readonly phase: SessionPhase;
  readonly emissions: ReadonlyArray<SessionEmission>;
};

export type SessionPlanInput = Readonly<{
  runner: RunnerState | null;
  phase: SessionPhase;
  /**
   * Current Model time in ms. A plan that creates a runner from Idle stamps it
   * here, so the planner never reads the clock itself.
   */
  now: number;
}>;

export const planSession = (
  { runner, phase, now }: SessionPlanInput,
  event: SessionEvent,
): SessionPlan => {
  try {
    const plan = Effect.runSync(
      Effect.gen(function* () {
        const decoded = yield* Machine.decodeSnapshot(
          SessionMachine,
          toEncoded(runner, phase) as never,
        );
        return yield* Machine.plan(SessionMachine, decoded as never, event as never);
      }),
    );
    const { runner: nextRunner, phase: nextPhase } = snapshotToRunner(plan.next as never, now);
    return {
      runner: nextRunner,
      phase: nextPhase,
      emissions: plan.emittedEvents as unknown as ReadonlyArray<SessionEmission>,
    };
  } catch (error) {
    console.error("[sessionMachine] plan failed", error);
    return { runner, phase, emissions: [] };
  }
};
