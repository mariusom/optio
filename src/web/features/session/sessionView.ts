import type { HtmlBuilder } from "foldkit/html";

import type { Message } from "../../../messages";
import { storageNotice } from "../../storageNotice";
import type { RunnerState } from "./runner";
import { runnerSheets, runnerView } from "./runnerView";
import { sessionTabletView } from "./tabletView";

type SessionModel = {
  readonly runner: RunnerState | null;
  readonly storage: "opening" | "persisted" | "in-memory" | "unavailable";
  readonly memoryStorageAcknowledged: boolean;
};

export const sessionView = (model: SessionModel, h: HtmlBuilder<Message>) => {
  const storage = storageNotice(model, h, { recording: true });
  return h.div(
    [h.Class("flex w-full h-full flex-col")],
    [
      ...(storage === null
        ? []
        : [
            h.div(
              [h.Class("shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6")],
              [storage],
            ),
          ]),
      h.div(
        [h.Class("flex md:hidden w-full min-h-0 flex-1 flex-col")],
        [runnerView(model as Parameters<typeof runnerView>[0], h)],
      ),
      h.div(
        [h.Class("hidden md:flex w-full min-h-0 flex-1 flex-col")],
        [sessionTabletView(model.runner, h)],
      ),
      ...runnerSheets(model.runner, h),
    ],
  );
};
