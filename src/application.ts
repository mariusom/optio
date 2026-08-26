import type { Url } from "foldkit/url";
import { UrlRequest } from "foldkit/navigation";

import { Message } from "./messages.ts";
import { parseRoute } from "./we/routes.ts";
import { Model, init, subscriptions, update, view } from "./main.ts";

/**
 * Everything `Runtime.makeApplication` needs except the DOM container.
 *
 * Kept out of entry.ts so tests can assert the wiring without touching the
 * DOM (or the service-worker registration). In particular `subscriptions`
 * MUST be present: the seven store→model streams (templates, history,
 * details, active session, runner, ticker) only start when the runtime
 * receives them. Dropping this field silently kills every reactive update —
 * the app renders shells but shows no data.
 */
export const applicationConfig = {
  Model,
  init,
  update,
  view,
  subscriptions,
  routing: {
    // foldkit preventDefaults same-origin anchor clicks and hands us the
    // request; history is written by our NavigateInternal/NavigateExternal
    // Commands (pushUrl/load), which come back here as onUrlChange.
    onUrlRequest: (request: UrlRequest) => Message.ClickedLink({ request }),
    onUrlChange: (url: Url) => Message.GotRoute({ route: parseRoute(url) }),
  },
} as const;
