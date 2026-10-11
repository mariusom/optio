import type { HtmlBuilder } from "foldkit/html";

import { notice } from "@/components/app";
import { Message } from "../../../messages";
import { storageNotice } from "../../storageNotice";
import type { RunnerState } from "./runner";
import { runnerSheets, runnerView } from "./runnerView";
import { sessionTabletView } from "./tabletView";

type SessionModel = {
  readonly runner: RunnerState | null;
  readonly storage: "opening" | "persisted" | "in-memory" | "unavailable";
  readonly memoryStorageAcknowledged: boolean;
  readonly saveStalled: boolean;
  readonly backupBusy: boolean;
  readonly joinedExistingSession: boolean;
};

/** Starting found another tab's live session; only one can record at a time. */
const joinedNotice = (runner: RunnerState | null, h: HtmlBuilder<Message>) =>
  notice(
    {
      tone: "info",
      text: `Another tab had already started “${
        runner === null ? "a session" : runner.sessionName || runner.templateName
      }”. Only one session can record at a time, so you’re in that one.`,
      onDismiss: Message.DismissedJoinedSession(),
      dismissLabel: "Dismiss",
    },
    h,
  );

export const sessionView = (model: SessionModel, h: HtmlBuilder<Message>) => {
  const storage =
    storageNotice(model, h, { recording: true }) ??
    (model.joinedExistingSession ? joinedNotice(model.runner, h) : null);
  return h.div(
    [h.Class("flex w-full h-full flex-col"), h.DataAttribute("runner-layout", "")],
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
        [
          h.Class("flex md:hidden w-full min-h-0 flex-1 flex-col"),
          h.DataAttribute("runner-layout", ""),
        ],
        [runnerView(model as Parameters<typeof runnerView>[0], h)],
      ),
      h.div(
        [
          h.Class("hidden md:flex w-full min-h-0 flex-1 flex-col"),
          h.DataAttribute("runner-layout", ""),
        ],
        [sessionTabletView(model.runner, h)],
      ),
      ...runnerSheets(model.runner, h),
    ],
  );
};
