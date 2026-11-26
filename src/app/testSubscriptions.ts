import { Effect } from "effect";

import type { AppCommand } from "../messages";
import { init } from "../main";
import type { Model } from "./model";
import { subscriptions } from "./subscriptions";

/** The stream of the subscription `model` runs under `name`; throws when it isn't running. */
export const streamOf = (model: Model, name: string) => {
  for (const subscription of subscriptions(model))
    if (subscription !== false && subscription.name === name) return subscription.stream;
  throw new Error(`${name} is not running`);
};

/** The stream the app runs under `name` on the page at `hash`. */
export const streamAt = (hash: string, name: string) => streamOf(init(hash).model, name);

/** Runs a Command's Effect; a test of a stream Command reads `.stream` instead. */
export const runCommand = (command: AppCommand) =>
  command._tag === "Effect"
    ? command.effect
    : Effect.die(`${command._tag} is not an Effect Command`);
