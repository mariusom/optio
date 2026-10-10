import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import { init, update } from "../main";
import { Message } from "../messages";

const start = init(Option.getOrThrow(fromString("https://optio.test/#/start"))).model;

const commandNames = (storage: typeof start.storage) =>
  (update({ ...start, storage }, Message.SessionStarted({ sessionId: "s" })).commands ?? []).map(
    (command) => command.name,
  );

describe("persistent storage request", () => {
  it("asks the browser to keep studies once a session starts on disk", () => {
    expect(commandNames("persisted")).toContain("RequestPersistentStorage");
  });

  it("does not ask when studies are only kept in memory or storage failed", () => {
    expect(commandNames("in-memory")).not.toContain("RequestPersistentStorage");
    expect(commandNames("unavailable")).not.toContain("RequestPersistentStorage");
  });

  it("treats the answer as information only", () => {
    const model = { ...start, storage: "persisted" as const };
    const result = update(model, Message.PersistentStorageChecked({ granted: false }));
    expect(result.model).toBe(model);
    expect(result.commands ?? []).toEqual([]);
  });
});
