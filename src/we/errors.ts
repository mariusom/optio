import { Cause } from "effect";

/**
 * Users never see stack traces or storage internals. Every failed operation is
 * reported as one short sentence that says what didn't happen; the underlying
 * cause goes to the console for debugging.
 */
export type FailedAction =
  | "save"
  | "load"
  | "start"
  | "record"
  | "end"
  | "delete"
  | "export"
  | "create"
  | "duplicate";

const phrases: Record<FailedAction, string> = {
  save: "Couldn't save that. Please try again.",
  load: "Couldn't load that right now. Please try again.",
  start: "Couldn't start the session. Please try again.",
  record: "Couldn't record that task. Please try again.",
  end: "Couldn't end the session. Please try again.",
  delete: "Couldn't delete that. Please try again.",
  export: "Couldn't create the export. Please try again.",
  create: "Couldn't create that. Please try again.",
  duplicate: "Couldn't make a copy. Please try again.",
};

/** Plain-language message for a failed action; logs the technical cause. */
export const friendlyFailure = (action: FailedAction, cause: unknown): string => {
  if (typeof console !== "undefined") {
    const detail = Cause.isCause(cause) ? Cause.pretty(cause) : cause;
    console.error(`[optio] ${action} failed:`, detail);
  }
  return phrases[action];
};
