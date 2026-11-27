import { Effect, Layer } from "effect";
import { SecureRandom } from "effect/crypto";
import { describe, expect, it } from "@effect/vitest";
import { afterEach, vi } from "vite-plus/test";

import { getStore, type AppStore } from "../../../store/client";
import { events } from "../../../store/schema";
import type { Select } from "../../../store/tables";
import { Message } from "../../../messages";
import { IdRandom } from "../../../lib/ids";
import { DiscardLiveSession, StartSession } from "./startCommands";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));

/** Secure randomness drawing all-zero bytes, so every UUID is predictable. */
const zeroCrypto = Layer.succeed(
  IdRandom,
  SecureRandom.make((size) => new Uint8Array(size)),
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(["start", "discard"] as const)("%s session failures", (operation) => {
  it.effect.each(["open", "commit"] as const)("reports %s failures in plain language", (failure) =>
    Effect.gen(function* () {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const commit = vi.fn(() => {
        throw new Error("Persistence unavailable");
      });
      if (failure === "open") {
        vi.mocked(getStore).mockRejectedValue(new Error("Persistence unavailable"));
      } else {
        vi.mocked(getStore).mockResolvedValue({
          query: () => (operation === "discard" ? [{ endedAt: null }] : []),
          commit,
        } as unknown as AppStore);
      }
      const command =
        operation === "start"
          ? StartSession.make({
              id: "s",
              templateId: null,
              templateName: "",
              sessionName: "S",
              fields: [],
            })
          : DiscardLiveSession.make({ sessionId: "s" });
      const result = yield* command.effect;
      expect(result).toMatchObject({
        _tag: "FailedSessionOp",
        error:
          operation === "start"
            ? "Couldn't start the session. Please try again."
            : "Couldn't delete that. Please try again.",
      });
      expect(result._tag === "FailedSessionOp" ? result.error : "").not.toContain(
        "Persistence unavailable",
      );
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining("failed"),
        expect.stringContaining("Persistence unavailable"),
      );
      if (failure === "open") expect(commit).not.toHaveBeenCalled();
    }),
  );
});

describe("DiscardLiveSession live-session guard", () => {
  it.effect.each([
    ["missing", []],
    ["ended", [{ endedAt: new Date() }]],
  ])("acknowledges a %s session without writing", ([_label, sessions]) =>
    Effect.gen(function* () {
      const query = vi.fn(() => sessions);
      const commit = vi.fn(() => Effect.void);
      vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

      const message = yield* DiscardLiveSession.make({ sessionId: "s" }).effect;
      expect(message).toEqual(Message.SucceededDiscardLiveSession());
      expect(query).toHaveBeenCalledTimes(1);
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("deletes a live session", () =>
    Effect.gen(function* () {
      const query = vi.fn(() => [{ endedAt: null }]);
      const commit = vi.fn(() => Effect.void);
      vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

      const message = yield* DiscardLiveSession.make({ sessionId: "s" }).effect;
      expect(message).toEqual(Message.SucceededDiscardLiveSession());
      expect(query).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith(
        events.sessionLiveGraphCleared({ sessionId: "s" }),
        events.sessionDeleted({ id: "s" }),
      );
    }),
  );

  it.effect("reports query failures without writing", () =>
    Effect.gen(function* () {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const query = vi.fn(() => {
        throw new Error("Query unavailable");
      });
      const commit = vi.fn(() => Effect.void);
      vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

      const message = yield* DiscardLiveSession.make({ sessionId: "s" }).effect;
      expect(message).toMatchObject({
        _tag: "FailedSessionOp",
        error: "Couldn't delete that. Please try again.",
      });
      expect(commit).not.toHaveBeenCalled();
    }),
  );
});

describe("StartSession template resolution", () => {
  it.effect(
    "keeps a zero-field template ID instead of borrowing a same-name template's fields",
    () =>
      Effect.gen(function* () {
        const taskId = "00000000-0000-4000-8000-000000000000";
        const query = vi
          .fn()
          .mockReturnValueOnce([])
          .mockReturnValueOnce([])
          .mockReturnValueOnce([
            { id: "other", name: "Shared name" },
            { id: "empty", name: "Shared name" },
          ])
          // After committing, the command checks which session is live.
          .mockReturnValueOnce([{ id: "session" }])
          .mockReturnValueOnce([
            {
              id: "other-field",
              name: "Must not be copied",
              kind: "textInput",
              isRequired: 1,
              defaultValue: "",
              sortOrder: 0,
              optionsJson: "[]",
              exclusiveOptionsJson: "[]",
            },
          ]);
        const commit = vi.fn(() => Effect.void);
        vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

        const message = yield* StartSession.make({
          id: "session",
          templateId: "empty",
          templateName: "Shared name",
          sessionName: "Session",
          fields: [],
        }).effect;
        expect(message).toEqual(
          Message.SucceededStartSession({ sessionId: "session", joinedExisting: false }),
        );
        expect(query).toHaveBeenCalledTimes(4);
        expect(commit).toHaveBeenCalledWith(
          {
            name: "v3.SessionStarted",
            args: {
              id: "session",
              templateId: "empty",
              templateName: "Shared name",
              sessionName: "Session",
              now: expect.any(Date),
            },
          },
          events.taskSpawned({
            sessionId: "session",
            id: taskId,
            orderIndex: 1,
            fields: [],
          }),
        );
      }).pipe(Effect.provide(zeroCrypto)),
  );
});

const args = (id: string) => ({
  id,
  templateId: null,
  templateName: "Template",
  sessionName: "Session",
  fields: [
    {
      id: "field",
      name: "Field",
      kind: "textInput" as const,
      isRequired: false,
      defaultValue: "",
      sortOrder: 0,
      options: [],
      exclusiveOptions: [],
    },
  ],
});

describe("StartSession active-session guard", () => {
  it.effect("creates one session for concurrent rapid starts and acknowledges the same ID", () =>
    Effect.gen(function* () {
      const sessions: Array<{ id: string; endedAt: Date | null }> = [];
      const commit = vi.fn(() => {
        sessions.push({ id: "first", endedAt: null });
        return Effect.void;
      });
      const query = vi.fn(() => sessions);
      vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

      const [first, second] = yield* Effect.all(
        [StartSession.make(args("first")).effect, StartSession.make(args("second")).effect],
        { concurrency: "unbounded" },
      );

      expect(first).toEqual(
        Message.SucceededStartSession({ sessionId: "first", joinedExisting: false }),
      );
      expect(second).toEqual(
        Message.SucceededStartSession({ sessionId: "first", joinedExisting: true }),
      );
      expect(commit).toHaveBeenCalledTimes(1);
    }),
  );

  it.effect("does not let ended sessions block a new start", () =>
    Effect.gen(function* () {
      // Only live sessions are read; an ended one never reaches the guard.
      const query = vi.fn((input: Select<unknown>) =>
        "endedAt" in input.filters ? [] : [{ id: "ended", endedAt: new Date() }],
      );
      const commit = vi.fn(() => Effect.void);
      vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

      const message = yield* StartSession.make(args("new")).effect;
      expect(message).toEqual(
        Message.SucceededStartSession({ sessionId: "new", joinedExisting: false }),
      );
      expect(commit).toHaveBeenCalledTimes(1);
    }),
  );

  it.effect("acknowledges an active session without writing", () =>
    Effect.gen(function* () {
      const query = vi.fn(() => [{ id: "active", endedAt: null }]);
      const commit = vi.fn(() => Effect.void);
      vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

      const message = yield* StartSession.make(args("new")).effect;
      expect(message).toEqual(
        Message.SucceededStartSession({ sessionId: "active", joinedExisting: true }),
      );
      expect(commit).not.toHaveBeenCalled();
    }),
  );
});
