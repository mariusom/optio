import type { Url } from "foldkit/url";
import { UrlRequest } from "foldkit/navigation";

import { Message } from "./messages.ts";
import { parseRoute } from "./web/routes.ts";
import { Flags, Model, initWithFlags, subscriptions, update, view } from "./main.ts";
import { agentPorts } from "./agents/actions";

// Separate from entry.ts so wiring tests don't start the browser runtime.
export const applicationConfig = {
  Model,
  Flags,
  ports: agentPorts,
  init: initWithFlags,
  update,
  view,
  subscriptions,
  // Development-only inspector. The 1 Hz Tick would flood its history. Never
  // pass the Message schema or an MCP port: that would let outside tools
  // dispatch Messages without the consent flow in docs/agent-access.md.
  devTools: { excludeFromHistory: ["Tick"] },
  routing: {
    // FoldKit intercepts same-origin links; navigation commands update history.
    onUrlRequest: (request: UrlRequest) => Message.ClickedLink({ request }),
    onUrlChange: (url: Url) => Message.GotRoute({ route: parseRoute(url) }),
  },
} as const;
