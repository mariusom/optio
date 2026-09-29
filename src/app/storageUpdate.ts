import type { Update } from "foldkit";

import { Message } from "../messages";
import { RetryStore } from "../web/storageNotice";
import type { Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = Parameters<typeof Message.match<Result>>[1];

type StorageHandlers = Pick<
  AllHandlers,
  "StoreOpened" | "StoreUnavailable" | "ClickedRetryStore" | "AcknowledgedMemoryStorage"
>;

export const storageHandlers = (model: Model): StorageHandlers => ({
  StoreOpened: ({ storageMode }) => ({ model: { ...model, storage: storageMode } }),
  StoreUnavailable: () => ({ model: { ...model, storage: "unavailable" } }),
  ClickedRetryStore: () => ({
    model: { ...model, storage: "opening" },
    commands: [RetryStore({})],
  }),
  AcknowledgedMemoryStorage: () => ({ model: { ...model, memoryStorageAcknowledged: true } }),
});
