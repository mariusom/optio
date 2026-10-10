import { Effect } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";

/** Short enough to feel like a tap, not an alert. */
const recordedPulseMs = 30;

/**
 * Confirms a recorded task with a short vibration where the browser supports
 * it. Unsupported browsers, blocked calls and failures are skipped silently:
 * the visible status already confirms the recording.
 */
export const VibrateRecorded = Command.define("VibrateRecorded", {
  messages: [Message.GaveRecordFeedback],
  execute: Effect.sync(() => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
        navigator.vibrate(recordedPulseMs);
    } catch {
      // Vibration is optional feedback.
    }
    return Message.GaveRecordFeedback();
  }),
});
