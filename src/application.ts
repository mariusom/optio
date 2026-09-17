import type { Url } from "foldkit/url";
import { UrlRequest } from "foldkit/navigation";

import { Message } from "./messages.ts";
import { parseRoute } from "./web/routes.ts";
import { Model, init, subscriptions, update, view } from "./main.ts";
import { agentPorts } from "./agents/actions";

// Separate from entry.ts so wiring tests don't start the browser runtime.
export const applicationConfig = {
  Model,
  ports: agentPorts,
  init,
  update,
  view,
  subscriptions,
  routing: {
    // FoldKit intercepts same-origin links; navigation commands update history.
    onUrlRequest: (request: UrlRequest) => Message.ClickedLink({ request }),
    onUrlChange: (url: Url) => Message.GotRoute({ route: parseRoute(url) }),
  },
} as const;
