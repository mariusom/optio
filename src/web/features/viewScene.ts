import { Html } from "@effect/ui/html";
import { HtmlScene } from "@effect/ui/html/testing";
import { Schema } from "effect";

import type { H, Ui } from "@/lib/view";
import { Message } from "../../messages";

/**
 * Test scene of one fixed page view: every message the view sends comes out
 * as an event, so a test asserts it with `emitted(...)`. Scoped, like
 * `HtmlScene.make`.
 */
export const viewScene = (view: (h: H<Message>) => Ui) =>
  HtmlScene.make(
    Html.component({
      name: "ViewScene",
      model: Schema.Null,
      message: Message,
      events: Message,
    }).make({
      init: () => null,
      update: ($, message) => $.emit(message),
      view: (h) => view(h),
    }),
    {},
  );
