import type { H } from "@/lib/view";

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
const joinedNotice = (runner: RunnerState | null, h: H<Message>) =>
  notice(
    {
      tone: "info",
      text: `Another tab had already started “${
        runner === null
          ? "a session"
          : runner.sessionName !== ""
            ? runner.sessionName
            : runner.templateName
      }”. Only one session can record at a time, so you’re in that one.`,
      onDismiss: Message.DismissedJoinedSession(),
      dismissLabel: "Dismiss",
    },
    h,
  );

export const sessionView = (model: SessionModel, h: H<Message>) => {
  const storage =
    storageNotice(model, h, { recording: true }) ??
    (model.joinedExistingSession ? joinedNotice(model.runner, h) : null);
  return h.div
    .class("flex w-full h-full flex-col")
    .attr("data-runner-layout", "")
    .children(
      storage === null
        ? []
        : [
            h.div
              .class("shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6")
              .children(storage),
          ],
      h.div
        .class("flex md:hidden w-full min-h-0 flex-1 flex-col")
        .attr("data-runner-layout", "")
        .children(runnerView(model as Parameters<typeof runnerView>[0], h)),
      h.div
        .class("hidden md:flex w-full min-h-0 flex-1 flex-col")
        .attr("data-runner-layout", "")
        .children(sessionTabletView(model.runner, h)),
      runnerSheets(model.runner, h),
    );
};
