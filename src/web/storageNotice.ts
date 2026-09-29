import { Effect } from "effect";
import { Command } from "foldkit";
import type { HtmlBuilder } from "foldkit/html";

import { notice } from "@/components/app";
import { button } from "@/components/ui/button";
import { openStoreAccess } from "../livestore/access";
import { Message } from "../messages";

/** Opens the store again after a failure; subscriptions resume when it opens. */
export const RetryStore = Command.define("RetryStore", {
  args: {},
  messages: [Message.StoreOpened, Message.StoreUnavailable],
  execute: () =>
    openStoreAccess.pipe(
      Effect.map(({ store }) => Message.StoreOpened({ storageMode: store.storageMode })),
      Effect.catch(() => Effect.succeed(Message.StoreUnavailable())),
    ),
});

type StorageModel = {
  readonly storage: "opening" | "persisted" | "in-memory" | "unavailable";
  readonly memoryStorageAcknowledged: boolean;
};

/**
 * Storage problems the user must know about. In-memory storage stays visible
 * where studies are recorded; elsewhere it can be acknowledged.
 */
export const storageNotice = (
  model: StorageModel,
  h: HtmlBuilder<Message>,
  { recording }: { readonly recording: boolean },
) => {
  if (model.storage === "unavailable")
    return notice(
      {
        tone: "error",
        text: h.div(
          [h.Class("flex flex-wrap items-center gap-x-3 gap-y-2")],
          [
            h.span(
              [h.Class("min-w-0 flex-1 basis-48")],
              ["Your studies can’t be opened right now. Close other Optio tabs, then try again."],
            ),
            button(
              {
                type: "button",
                variant: "outline",
                className: "h-11 text-foreground",
                onClick: Message.ClickedRetryStore(),
              },
              "Try again",
              h,
            ),
          ],
        ),
      },
      h,
    );
  if (model.storage === "in-memory" && (recording || !model.memoryStorageAcknowledged))
    return notice(
      {
        tone: "warning",
        role: "alert",
        text: "This browser isn’t saving studies, for example in a private window. Anything recorded here is lost when the tab closes. Export sessions you want to keep.",
        ...(recording
          ? {}
          : {
              onDismiss: Message.AcknowledgedMemoryStorage(),
              dismissLabel: "Dismiss storage warning",
            }),
      },
      h,
    );
  return null;
};
