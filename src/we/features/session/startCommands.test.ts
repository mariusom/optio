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
      vi.mocked(getStore).mockResolvedValue({ query: () => [], commit } as unknown as AppStore);
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

describe("StartSession template resolution", () => {
  it("keeps a zero-field template ID instead of borrowing a same-name template's fields", async () => {
    const taskId = "00000000-0000-4000-8000-000000000001";
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(taskId);
    const query = vi
      .fn()
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
    expect(query).toHaveBeenCalledTimes(2);
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
