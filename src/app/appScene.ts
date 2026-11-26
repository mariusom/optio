// @effect-diagnostics experimentalApiUsage:off -- Effect UI testing is a public preview.
import { Html } from "@effect/ui/html";
import { HtmlScene } from "@effect/ui/html/testing";

import { Message } from "../messages";
import { Model } from "./model";
import { view } from "./view";

/** The whole app view for a fixed Model; messages leave the Model as it is. */
const AppAt = Html.component({
  name: "OptioAt",
  props: Model,
  model: Model,
  message: Message,
}).make({
  init: ($) => $.props,
  update: ($) => $.model,
  view: (h, model) => view(model, h),
});

/** Test scene of the whole app showing `model`, for page-composition tests. */
export const appScene = (model: Model) => HtmlScene.start(AppAt, model);
