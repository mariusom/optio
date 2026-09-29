import type { Stream } from "effect";
import { storeStream } from "./managedStream";
import { Message } from "../messages";

/** Reports once the store opens (and how it persists), or that it cannot open. */
export const storageStatusStream: Stream.Stream<Message> = storeStream(
  Message.StoreUnavailable(),
  ({ store }, emit) => {
    emit(Message.StoreOpened({ storageMode: store.storageMode }));
    return [];
  },
);
