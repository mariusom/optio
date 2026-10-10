import { Effect, Option, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { fromString } from "foldkit/url";
import { beforeEach, vi } from "vitest";

import { getStore, type AppStore } from "../livestore/client";
import { init, subscriptions, update } from "../main";
import { Message } from "../messages";
import { HistoryTab } from "../web/routes";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

const at = (hash: string) =>
  init(Option.getOrThrow(fromString(`https://optio.test/#${hash}`))).model;

beforeEach(() => vi.resetAllMocks());

/** A store that opens but whose reads throw. */
const unreadableStore = {
  storageMode: "persisted",
  subscribe: () => {
    throw new Error("query failed");
  },
} as unknown as AppStore;

describe("detail pages when an item cannot be read", () => {
  it.effect("reports a failed session read instead of staying on “Opening…”", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockResolvedValue(unreadableStore);
      const messages = yield* subscriptions.historyDetail
        .dependenciesToStream({ sessionId: "s1" })
        .pipe(Stream.take(1), Stream.runCollect);
      expect(messages).toEqual([Message.FailedDetailLoad()]);
    }),
  );

  it.effect("reports a failed template read", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockResolvedValue(unreadableStore);
      const messages = yield* subscriptions.templateDetail
        .dependenciesToStream({ templateId: "t1" })
        .pipe(Stream.take(1), Stream.runCollect);
      expect(messages).toEqual([Message.FailedDetailLoad()]);
    }),
  );

  it.effect("reports an unopenable store as unavailable, not as a failed read", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockRejectedValue(new Error("storage unavailable"));
      const messages = yield* subscriptions.historyDetail
        .dependenciesToStream({ sessionId: "s1" })
        .pipe(Stream.take(1), Stream.runCollect);
      expect(messages).toEqual([Message.StoreUnavailable()]);
    }),
  );

  it.effect("reports a failed list read so its page can offer a retry", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockResolvedValue(unreadableStore);
      const messages = yield* subscriptions.history
        .dependenciesToStream({ attempt: 0 })
        .pipe(Stream.take(1), Stream.runCollect);
      expect(messages).toEqual([Message.FailedListRead({ list: "history" })]);
    }),
  );

  it("keeps the failure until the route changes", () => {
    const failed = update(at("/history/s1"), Message.FailedDetailLoad()).model;
    expect(failed.detailLoadFailed).toBe(true);
    const moved = update(failed, Message.GotRoute({ route: HistoryTab() })).model;
    expect(moved.detailLoadFailed).toBe(false);
  });
});
