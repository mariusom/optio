import { Effect, Stream } from "effect";
import { expect, it } from "@effect/vitest";
import { vi } from "vite-plus/test";

import { getStore, type AppStore } from "../store/client";
import { update, init } from "../main";
import { streamOf } from "./testSubscriptions";
import { Message } from "../messages";
import { RetryStore } from "../web/storageNotice";

vi.mock("../store/client", () => ({ getStore: vi.fn() }));

it.effect("reports an unavailable store, then resumes its subscription after a retry", () =>
  Effect.gen(function* () {
    const store = {
      storageMode: "persisted",
      subscribe: (_query: unknown, callback: (value: unknown) => void) => {
        callback(null);
        return () => {};
      },
    };
    vi.mocked(getStore)
      .mockRejectedValueOnce(new Error("Storage is locked"))
      .mockResolvedValue(store as unknown as AppStore);

    const retried: Array<Message> = [];
    const messages = yield* streamOf(init("#/start").model, "activeSession").pipe(
      Stream.tap((message) =>
        message._tag === "StoreUnavailable"
          ? Effect.map(RetryStore.make({}).effect, (result) => retried.push(result))
          : Effect.void,
      ),
      Stream.take(2),
      Stream.runCollect,
    );

    expect(messages).toEqual([
      Message.StoreUnavailable(),
      Message.GotActiveSession({ activeSession: null }),
    ]);
    expect(retried).toEqual([Message.StoreOpened({ storageMode: "persisted" })]);
  }),
);

it("shows retry and in-memory storage states", () => {
  const { model } = init("");
  const unavailable = update(model, Message.StoreUnavailable()).model;
  expect(unavailable.storage).toBe("unavailable");
  const retry = update(unavailable, Message.ClickedRetryStore());
  expect(retry.model.storage).toBe("opening");
  expect(retry.commands).toEqual([expect.objectContaining({ name: "RetryStore" })]);
  const memory = update(retry.model, Message.StoreOpened({ storageMode: "in-memory" })).model;
  expect(memory.storage).toBe("in-memory");
  expect(update(memory, Message.AcknowledgedMemoryStorage()).model.memoryStorageAcknowledged).toBe(
    true,
  );
});
