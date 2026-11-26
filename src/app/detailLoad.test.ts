import { Effect, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { beforeEach, vi } from "vite-plus/test";

import { getStore, type AppStore } from "../store/client";
import { init, update } from "../main";
import { streamOf } from "./testSubscriptions";
import { Message } from "../messages";
import { HistoryTab } from "../web/routes";

vi.mock("../store/client", () => ({ getStore: vi.fn() }));

const at = (hash: string) => init(`#${hash}`).model;

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
      const messages = yield* streamOf(at("/history/s1"), "historyDetail").pipe(
        Stream.take(1),
        Stream.runCollect,
      );
      expect(messages).toEqual([Message.FailedDetailLoad()]);
    }),
  );

  it.effect("reports a failed template read", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockResolvedValue(unreadableStore);
      const messages = yield* streamOf(at("/templates/t1"), "templateDetail").pipe(
        Stream.take(1),
        Stream.runCollect,
      );
      expect(messages).toEqual([Message.FailedDetailLoad()]);
    }),
  );

  it.effect("reports an unopenable store as unavailable, not as a failed read", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockRejectedValue(new Error("storage unavailable"));
      const messages = yield* streamOf(at("/history/s1"), "historyDetail").pipe(
        Stream.take(1),
        Stream.runCollect,
      );
      expect(messages).toEqual([Message.StoreUnavailable()]);
    }),
  );

  it.effect("reports a failed list read so its page can offer a retry", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockResolvedValue(unreadableStore);
      const messages = yield* streamOf(at("/history"), "history").pipe(
        Stream.take(1),
        Stream.runCollect,
      );
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
