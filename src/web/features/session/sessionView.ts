import type { HtmlBuilder } from "foldkit/html";

import type { Message } from "../../../messages";
import type { RunnerState } from "./runner";
import { runnerView } from "./runnerView";
import { sessionTabletView } from "./tabletView";

type SessionModel = {
  readonly runner: RunnerState | null;
};

export const sessionView = (model: SessionModel, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class("w-full h-full")],
    [
      h.div(
        [h.Class("flex md:hidden w-full h-full flex-col")],
        [runnerView(model as Parameters<typeof runnerView>[0], h)],
      ),
      h.div(
        [h.Class("hidden md:flex w-full h-full flex-col")],
        [sessionTabletView(model.runner, h)],
      ),
    ],
  );
