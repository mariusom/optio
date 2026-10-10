import { Effect, Option, Stream } from "effect";
import { expect, it } from "@effect/vitest";
import { vi } from "vitest";

import { getStore, type AppStore } from "../livestore/client";
import { subscriptions, update, init } from "../main";
import { Message } from "../messages";
import { RetryStore } from "../web/storageNotice";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

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
    const messages = yield* subscriptions.activeSession.dependenciesToStream({ attempt: 0 }).pipe(
      Stream.tap((message) =>
        message._tag === "StoreUnavailable"
          ? Effect.map(RetryStore().effect, (result) => retried.push(result))
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
  const { model } = init({
    protocol: "https:",
    host: "example.com",
    port: Option.none(),
    pathname: "/",
    search: Option.none(),
    hash: Option.none(),
  });
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
