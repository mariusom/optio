import { Head } from "@effect/ui";
import { Html } from "@effect/ui/html";

import { Message } from "./messages.ts";
import { Flags, Model, initWithFlags, subscriptions, update, view } from "./main.ts";
import { documentTitle } from "./app/view.ts";

/**
 * The app as one Effect UI root component. Its Model, update and view are the
 * app's pure functions; each root handler returns `{ model, commands }`, which
 * becomes `$.set(model).run(...commands)`. Startup Flags arrive as props; the
 * route comes from the URL fragment. Kept apart from entry.ts so wiring tests
 * don't start the browser runtime.
 */
export const App = Html.component({
  name: "Optio",
  props: Flags,
  model: Model,
  message: Message,
}).make({
  init: ($) => {
    const initial = initWithFlags($.props, typeof location === "undefined" ? "" : location.hash);
    return $.set(initial.model).run(...initial.commands);
  },
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  subscriptions: ({ model }) => subscriptions(model),
  head: ({ model }) => [Head.title(documentTitle(model))],
  view: (h, model) => view(model, h),
});

/**
 * Development-only inspector settings. The 1 Hz Tick would flood its timeline.
 * Never enable its MCP dispatch: that would let outside tools send Messages
 * without the consent flow in docs/agent-access.md.
 */
export const devToolsOptions = { position: "BottomRight", exclude: ["Tick"] } as const;
