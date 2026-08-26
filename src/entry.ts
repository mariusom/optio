import { Runtime } from "foldkit";
import type { Url } from "foldkit/url";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import { Message } from "./messages.ts";
import { parseRoute } from "./we/routes.ts";
import { Model, init, update, view } from "./main.ts";

registerSW({ immediate: true });

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  routing: {
    // foldkit preventDefaults same-origin anchor clicks and hands us the
    // request; history is written by our NavigateInternal/NavigateExternal
    // Commands (pushUrl/load), which come back here as onUrlChange.
    onUrlRequest: (request) => Message.ClickedLink({ request }),
    onUrlChange: (url: Url) => Message.GotRoute({ route: parseRoute(url) }),
  },
  container: document.getElementById("root")!,
});

Runtime.run(application);
