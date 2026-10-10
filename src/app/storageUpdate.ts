import { AsyncData, type Update } from "foldkit";

import { Message, type MessageHandlers } from "../messages";
import { RetryStore } from "../web/storageNotice";
import type { Model, StoreList } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = MessageHandlers<Result>;

type StorageHandlers = Pick<
  AllHandlers,
  | "StoreOpened"
  | "StoreUnavailable"
  | "ClickedRetryStore"
  | "AcknowledgedMemoryStorage"
  | "FailedListRead"
  | "ClickedRetryListRead"
>;

/** A list already shown keeps its rows; one never read shows the failure. */
const failUnlessShown = <A>(data: AsyncData.AsyncData<A, "ReadFailed">) =>
  AsyncData.hasData(data) ? data : AsyncData.fail<"ReadFailed", A>("ReadFailed");

const failList = (model: Model, list: StoreList): Model => {
  switch (list) {
    case "templates":
      return { ...model, templates: failUnlessShown(model.templates) };
    case "history":
      return { ...model, history: failUnlessShown(model.history) };
    case "activeSession":
      return { ...model, activeSession: failUnlessShown(model.activeSession) };
  }
};

const anyListFailed = (model: Model) =>
  AsyncData.isFailure(model.templates) ||
  AsyncData.isFailure(model.history) ||
  AsyncData.isFailure(model.activeSession);

/** Failed lists go back to Loading for another read; others keep their data. */
const reloadFailedLists = (model: Model): Model => ({
  ...model,
  templates: AsyncData.isFailure(model.templates) ? AsyncData.Loading() : model.templates,
  history: AsyncData.isFailure(model.history) ? AsyncData.Loading() : model.history,
  activeSession: AsyncData.isFailure(model.activeSession)
    ? AsyncData.Loading()
    : model.activeSession,
});

export const storageHandlers = (model: Model): StorageHandlers => ({
  StoreOpened: ({ storageMode }) => ({ model: { ...model, storage: storageMode } }),
  StoreUnavailable: () => ({ model: { ...model, storage: "unavailable" } }),
  ClickedRetryStore: () => ({
    model: { ...model, storage: "opening" },
    commands: [RetryStore()],
  }),
  AcknowledgedMemoryStorage: () => ({ model: { ...model, memoryStorageAcknowledged: true } }),
  FailedListRead: ({ list }) => ({ model: failList(model, list) }),
  ClickedRetryListRead: () =>
    anyListFailed(model)
      ? { model: { ...reloadFailedLists(model), listReadAttempt: model.listReadAttempt + 1 } }
      : { model },
});
