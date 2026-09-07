import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore, type AppStore } from "../../../livestore/client";
import { events } from "../../../livestore/schema";
import { Message } from "../../../messages";
import { CreateTemplate, EnsureTemplatesSeeded, SetDefaultTemplate } from "./commands";

const query = vi.fn();
const commit = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  query.mockReturnValue([]);
  vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);
});

describe.each([
  ["create", () => CreateTemplate({ id: "new", name: "Study" }), Message.TemplateCreated()],
  ["set default", () => SetDefaultTemplate({ id: "existing" }), Message.TemplateOpDone()],
  ["seed", () => EnsureTemplatesSeeded({}), Message.TemplatesSeededCheck()],
] as const)("%s template persistence", (_name, command, success) => {
  it("reports success only after committing", async () => {
    expect(await Effect.runPromise<Message, never>(command().effect)).toEqual(success);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("reports a rejected store open as FailedTemplateOp", async () => {
    vi.mocked(getStore).mockRejectedValue(new Error("Store unavailable"));
    expect(await Effect.runPromise<Message, never>(command().effect)).toMatchObject({
      _tag: "FailedTemplateOp",
      error: expect.stringContaining("Store unavailable"),
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("reports a synchronous persistence failure as FailedTemplateOp", async () => {
    commit.mockImplementation(() => {
      throw new Error("Persistence failed");
    });
    expect(await Effect.runPromise<Message, never>(command().effect)).toMatchObject({
      _tag: "FailedTemplateOp",
      error: expect.stringContaining("Persistence failed"),
    });
  });
});

describe("CreateTemplate", () => {
  it("trims the committed name while reporting success and making the first template default", async () => {
    expect(
      await Effect.runPromise(CreateTemplate({ id: "new", name: "  Study  " }).effect),
    ).toEqual(Message.TemplateCreated());
    expect(commit).toHaveBeenCalledWith(
      events.templateCreated({ id: "new", name: "Study", isDefault: true }),
    );
  });
});

describe("template queries", () => {
  it.each([() => CreateTemplate({ id: "new", name: "Study" }), () => EnsureTemplatesSeeded({})])(
    "reports query failures without committing",
    async (command) => {
      query.mockImplementation(() => {
        throw new Error("Query failed");
      });
      expect(await Effect.runPromise<Message, never>(command().effect)).toMatchObject({
        _tag: "FailedTemplateOp",
        error: expect.stringContaining("Query failed"),
      });
      expect(commit).not.toHaveBeenCalled();
    },
  );

  it("skips seeding when templates already exist", async () => {
    query.mockReturnValue([{ id: "existing" }]);
    expect(await Effect.runPromise(EnsureTemplatesSeeded({}).effect)).toEqual(
      Message.TemplatesSeededCheck(),
    );
    expect(commit).not.toHaveBeenCalled();
  });
});
