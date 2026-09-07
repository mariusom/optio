import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore, type AppStore } from "../../../livestore/client";
import { events } from "../../../livestore/schema";
import { Message } from "../../../messages";
import { DiscardLiveSession, StartSession } from "./startCommands";

describe.each(["start", "discard"] as const)("%s session failures", (operation) => {
  it.each(["open", "commit"] as const)("reports %s failures", async (failure) => {
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
        ? StartSession({
            id: "s",
            templateId: null,
            templateName: "",
            sessionName: "S",
            fields: [],
          })
        : DiscardLiveSession({ sessionId: "s" });
    expect(await Effect.runPromise<Message, never>(command.effect)).toMatchObject({
      _tag: "FailedSessionOp",
      error: expect.stringContaining("Persistence unavailable"),
    });
    if (failure === "open") expect(commit).not.toHaveBeenCalled();
  });
});

describe("DiscardLiveSession live-session guard", () => {
  it.each([
    ["missing", []],
    ["ended", [{ endedAt: new Date() }]],
  ])("acknowledges a %s session without writing", async (_label, sessions) => {
    const query = vi.fn(() => sessions);
    const commit = vi.fn();
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    expect(await Effect.runPromise(DiscardLiveSession({ sessionId: "s" }).effect)).toEqual(
      Message.SessionDiscarded(),
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it("deletes a live session", async () => {
    const query = vi.fn(() => [{ endedAt: null }]);
    const commit = vi.fn();
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    expect(await Effect.runPromise(DiscardLiveSession({ sessionId: "s" }).effect)).toEqual(
      Message.SessionDiscarded(),
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(
      events.sessionLiveGraphCleared({ sessionId: "s" }),
      events.sessionDeleted({ id: "s" }),
    );
  });

  it("reports query failures without writing", async () => {
    const query = vi.fn(() => {
      throw new Error("Query unavailable");
    });
    const commit = vi.fn();
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    expect(await Effect.runPromise(DiscardLiveSession({ sessionId: "s" }).effect)).toMatchObject({
      _tag: "FailedSessionOp",
      error: expect.stringContaining("Query unavailable"),
    });
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("StartSession template resolution", () => {
  it("keeps a zero-field template ID instead of borrowing a same-name template's fields", async () => {
    const taskId = "00000000-0000-4000-8000-000000000001";
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(taskId);
    const query = vi
      .fn()
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        { id: "other", name: "Shared name" },
        { id: "empty", name: "Shared name" },
      ])
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
    const commit = vi.fn();
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    expect(
      await Effect.runPromise(
        StartSession({
          id: "session",
          templateId: "empty",
          templateName: "Shared name",
          sessionName: "Session",
          fields: [],
        }).effect,
      ),
    ).toEqual(Message.SessionStarted({ sessionId: "session" }));
    expect(query).toHaveBeenCalledTimes(3);
    expect(commit).toHaveBeenCalledWith(
      events.sessionStarted({
        id: "session",
        templateId: "empty",
        templateName: "Shared name",
        sessionName: "Session",
      }),
      events.taskSpawned({
        sessionId: "session",
        id: taskId,
        orderIndex: 1,
        fields: [],
      }),
    );
    uuid.mockRestore();
  });
});

describe("StartSession active-session guard", () => {
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

  it("creates one session for concurrent rapid starts and acknowledges the same ID", async () => {
    const sessions: Array<{ id: string; endedAt: Date | null }> = [];
    const commit = vi.fn(() => {
      sessions.push({ id: "first", endedAt: null });
    });
    const query = vi.fn(() => sessions);
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    const [first, second] = await Promise.all([
      Effect.runPromise(StartSession(args("first")).effect),
      Effect.runPromise(StartSession(args("second")).effect),
    ]);

    expect(first).toEqual(Message.SessionStarted({ sessionId: "first" }));
    expect(second).toEqual(Message.SessionStarted({ sessionId: "first" }));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does not let ended sessions block a new start", async () => {
    const query = vi.fn(() => [{ id: "ended", endedAt: new Date() }]);
    const commit = vi.fn();
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    expect(await Effect.runPromise(StartSession(args("new")).effect)).toEqual(
      Message.SessionStarted({ sessionId: "new" }),
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("acknowledges an active session without writing", async () => {
    const query = vi.fn(() => [{ id: "active", endedAt: null }]);
    const commit = vi.fn();
    vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);

    expect(await Effect.runPromise(StartSession(args("new")).effect)).toEqual(
      Message.SessionStarted({ sessionId: "active" }),
    );
    expect(commit).not.toHaveBeenCalled();
  });
});
