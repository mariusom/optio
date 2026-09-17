import type { Url } from "foldkit/url";

import { EnsureTemplatesSeeded } from "./web/features/templates/commands";
import { parseRoute } from "./web/routes";
import { initialModel } from "./app/model";

export { Model } from "./app/model";
export { subscriptions } from "./app/subscriptions";
export { update } from "./app/update";
export { view } from "./app/view";

export const init = (url: Url) => ({
  model: initialModel(parseRoute(url)),
  commands: [EnsureTemplatesSeeded({})],
});
