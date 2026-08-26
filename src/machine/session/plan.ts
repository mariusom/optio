/**
 * FoldKit ↔ effect-machine bridge — synchronous planning.
 *
 * FoldKit's `update()` is a pure, synchronous reducer, so the machine is
 * driven through `Machine.plan` (no async MachineRef). This module keeps the
 * snapshot translation (model.runner/runnerPhase ↔ machine snapshot) and
 * returns the machine's emissions; main.ts maps emissions to LiveStore
 * commands.
 *
 * `Machine.plan` requires *decoded* snapshots (schema class instances), so
 * the plain model state is first re-encoded through the machine's own
 * persistence boundary (`decodeSnapshot` with an "MachineSnapshot" record).
 * Everything stays pure + synchronous; no module-level machine state.
 */

import { Effect } from "effect";
import { Machine } from "@typeonce/effect-machine";

import type { RunnerState } from "../../we/features/session/runner";
import {
  SessionMachine,
  type LiveValue,
  type SessionEmission,
  type SessionEvent,
  type SessionPhase,
} from "./sessionMachine";

export type { RunnerState };

/** The machine path ↔ model phase mapping (model.runner null ⇒ Idle). */
const phaseToChildPath = (phase: SessionPhase): "Live.Collecting" | "Live.ConfirmingEnd" =>
  phase === "confirming" ? "Live.ConfirmingEnd" : "Live.Collecting";

const childPathToPhase = (childPath: string): SessionPhase =>
  childPath === "Live.ConfirmingEnd" ? "confirming" : "collecting";

/** RunnerState → machine value (data + control surface). */
export const runnerToValue = (runner: RunnerState): LiveValue => ({
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
  editBackup: runner.editBackup,
});

/** Plain (runner, phase) → machine persistence record (decode-safe form). */
const toEncoded = (runner: RunnerState | null, phase: SessionPhase) =>
  runner === null
    ? { _tag: "MachineSnapshot" as const, active: [{ path: "Idle" as const }] }
    : {
        _tag: "MachineSnapshot" as const,
        active: [
          { path: "Live" as const, value: runnerToValue(runner) },
          { path: phaseToChildPath(phase) },
        ],
      };

/** Machine snapshot → (runner, phase). Idle yields a null runner. */
export const snapshotToRunner = (
  next: { path: string; value?: unknown; state?: { path: string } },
  now: number,
): { runner: RunnerState | null; phase: SessionPhase } => {
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
      editBackup: value.editBackup,
    },
  };
};

export type SessionPlan = {
  readonly runner: RunnerState | null;
  readonly phase: SessionPhase;
  readonly emissions: ReadonlyArray<SessionEmission>;
};

/**
 * Plan one event against the current (runner, phase) pair. Pure + sync;
 * falls back to the unchanged state if plan fails (decode/plan errors are
 * caller bugs — log and keep the UI state rather than crash the app).
 */
export const planSession = (
  runner: RunnerState | null,
  phase: SessionPhase,
  event: SessionEvent,
): SessionPlan => {
  try {
    const decoded = Effect.runSync(
      Machine.decodeSnapshot(SessionMachine, toEncoded(runner, phase) as never),
    );
    const plan = Effect.runSync(Machine.plan(SessionMachine, decoded as never, event as never));
    const { runner: nextRunner, phase: nextPhase } = snapshotToRunner(
      plan.next as never,
      runner?.now ?? Date.now(),
    );
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
