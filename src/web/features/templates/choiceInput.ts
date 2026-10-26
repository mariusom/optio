import { Effect, Schema, String } from "effect";
import { Command } from "foldkit";

import { Message } from "../../../messages";

/** The "New choice" field's ID in the question editor. */
export const newChoiceInputId = "new-choice";

/**
 * Empties the "New choice" field once its text was added. The view only
 * re-renders between frames, and the field's rendered value was already ""
 * when typing began, so rendering alone never clears it; fast typing would
 * then append the next choice to the last ("AlphaBeta"). Commands run before
 * the next key event, and the field is cleared only while it still holds the
 * text that was added, so nothing typed afterwards is lost.
 */
export const ClearNewChoice = Command.define("ClearNewChoice", {
  args: { added: Schema.String },
  messages: [Message.ClearedNewChoice],
  execute: ({ added }) =>
    Effect.sync(() => {
      const input =
        typeof document === "undefined" ? null : document.getElementById(newChoiceInputId);
      if (input instanceof HTMLInputElement && String.trim(input.value) === added) input.value = "";
      return Message.ClearedNewChoice();
    }),
});
