import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore, type AppStore } from "../../../livestore/client";
import { events } from "../../../livestore/schema";
import { Message } from "../../../messages";
import {
  AddSampleTemplates,
  CreateTemplate,
  EnsureTemplatesSeeded,
  SetDefaultTemplate,
  sampleTemplates,
} from "./commands";

const query = vi.fn();
const commit = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  query.mockReturnValue([]);
  vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);
});

const seededTemplates = () => commit.mock.calls[0]?.[0]?.args?.templates ?? [];

describe.each([
  [
    "create",
    () => CreateTemplate({ id: "new", name: "Study" }),
    Message.TemplateCreated(),
    "Couldn't create that. Please try again.",
  ],
  [
    "set default",
    () => SetDefaultTemplate({ id: "existing" }),
    Message.TemplateOpDone(),
    "Couldn't save that. Please try again.",
  ],
  [
    "seed",
    () => EnsureTemplatesSeeded({}),
    Message.TemplatesSeededCheck(),
    "Couldn't create that. Please try again.",
  ],
  [
    "add samples",
    () => AddSampleTemplates({}),
    Message.SampleTemplatesAdded(),
    "Couldn't create that. Please try again.",
  ],
] as const)("%s template persistence", (_name, command, success, failure) => {
  it("reports success only after committing", async () => {
    expect(await Effect.runPromise<Message, never>(command().effect)).toEqual(success);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("reports a rejected store open in plain language, never a stack trace", async () => {
    vi.mocked(getStore).mockRejectedValue(new Error("Store unavailable"));
    expect(await Effect.runPromise<Message, never>(command().effect)).toEqual(
      Message.FailedTemplateOp({ error: failure }),
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it("reports a synchronous persistence failure in plain language", async () => {
    commit.mockImplementation(() => {
      throw new Error("Persistence failed");
    });
    expect(await Effect.runPromise<Message, never>(command().effect)).toEqual(
      Message.FailedTemplateOp({ error: failure }),
    );
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

describe("sampleTemplates", () => {
  it("offers one showcase study per setting, only the first being the default", () => {
    expect(sampleTemplates().map((template) => template.name)).toEqual([
      "Assembly line",
      "Ward round",
      "Warehouse pick",
    ]);
    expect(sampleTemplates().map((template) => template.isDefault)).toEqual([true, false, false]);
  });

  it("uses every answer type, with one choice that clears the others", () => {
    for (const template of sampleTemplates()) {
      expect(new Set(template.fields.map((f) => f.kind))).toEqual(
        new Set(["radio", "checkbox", "textInput", "textArea", "boolean"]),
      );
      const multi = template.fields.find((f) => f.kind === "checkbox");
      expect(multi?.exclusiveOptions).toEqual(["None"]);
      expect(multi?.options).toContain("None");
      expect(template.fields.map((f) => f.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(new Set(template.fields.map((f) => f.id)).size).toBe(template.fields.length);
    }
  });
});

describe("template queries", () => {
  it.each([
    () => CreateTemplate({ id: "new", name: "Study" }),
    () => EnsureTemplatesSeeded({}),
    () => AddSampleTemplates({}),
  ])("reports query failures without committing", async (command) => {
    query.mockImplementation(() => {
      throw new Error("Query failed");
    });
    expect(await Effect.runPromise<Message, never>(command().effect)).toMatchObject({
      _tag: "FailedTemplateOp",
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it("seeds the three sample templates when the app is empty", async () => {
    expect(await Effect.runPromise(EnsureTemplatesSeeded({}).effect)).toEqual(
      Message.TemplatesSeededCheck(),
    );
    expect(seededTemplates().map((t: { name: string }) => t.name)).toEqual([
      "Assembly line",
      "Ward round",
      "Warehouse pick",
    ]);
  });

  it("skips seeding when templates already exist", async () => {
    query.mockReturnValue([{ id: "existing" }]);
    expect(await Effect.runPromise(EnsureTemplatesSeeded({}).effect)).toEqual(
      Message.TemplatesSeededCheck(),
    );
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("AddSampleTemplates", () => {
  it("adds only the samples whose names are missing and keeps the current default", async () => {
    query.mockReturnValue([{ name: "Ward round" }, { name: "My own study" }]);
    expect(await Effect.runPromise(AddSampleTemplates({}).effect)).toEqual(
      Message.SampleTemplatesAdded(),
    );
    expect(seededTemplates().map((t: { name: string }) => t.name)).toEqual([
      "Assembly line",
      "Warehouse pick",
    ]);
    expect(seededTemplates().every((t: { isDefault: boolean }) => !t.isDefault)).toBe(true);
  });

  it("commits nothing when every sample is already there", async () => {
    query.mockReturnValue(sampleTemplates().map((template) => ({ name: template.name })));
    expect(await Effect.runPromise(AddSampleTemplates({}).effect)).toEqual(
      Message.SampleTemplatesAdded(),
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it("makes the first sample the default when the app has no templates", async () => {
    expect(await Effect.runPromise(AddSampleTemplates({}).effect)).toEqual(
      Message.SampleTemplatesAdded(),
    );
    expect(seededTemplates().map((t: { isDefault: boolean }) => t.isDefault)).toEqual([
      true,
      false,
      false,
    ]);
  });
});
