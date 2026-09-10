import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { afterEach, beforeEach, vi } from "vitest";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore, type AppStore } from "../../../livestore/client";
import { events } from "../../../livestore/schema";
import { Message } from "../../../messages";
import { SaveTemplate } from "./editorCommands";
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

afterEach(() => vi.restoreAllMocks());

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
  it.effect("reports success only after committing", () =>
    Effect.gen(function* () {
      expect(yield* command().effect).toEqual(success);
      expect(commit).toHaveBeenCalledOnce();
    }),
  );

  it.effect("reports a rejected store open in plain language, never a stack trace", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockRejectedValue(new Error("Store unavailable"));
      expect(yield* command().effect).toEqual(Message.FailedTemplateOp({ error: failure }));
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("reports a synchronous persistence failure in plain language", () =>
    Effect.gen(function* () {
      commit.mockImplementation(() => {
        throw new Error("Persistence failed");
      });
      expect(yield* command().effect).toEqual(Message.FailedTemplateOp({ error: failure }));
    }),
  );
});

describe("CreateTemplate", () => {
  it.effect.each([true, false])(
    "commits a new builder template with its fields (first: %s)",
    (first) =>
      Effect.gen(function* () {
        query.mockReturnValue(first ? [] : [{ id: "existing" }]);
        const fields = [
          {
            id: "question",
            name: "  Activity  ",
            kind: "textInput" as const,
            isRequired: true,
            defaultValue: "Observe",
            sortOrder: 7,
            options: [],
            exclusiveOptions: [],
          },
        ];
        expect(
          yield* SaveTemplate({
            id: "new",
            name: "  Study  ",
            isNew: true,
            isDefault: false,
            fields,
          }).effect,
        ).toEqual(Message.TemplateSaved());
        expect(commit).toHaveBeenCalledExactlyOnceWith(
          {
            name: "v3.TemplateCreated",
            args: { id: "new", name: "Study", isDefault: first, now: expect.any(Date) },
          },
          events.fieldsReplaced({
            templateId: "new",
            fields: [{ ...fields[0]!, name: "Activity", sortOrder: 0 }],
          }),
          ...(first ? [events.templateDefaultSet({ id: "new" })] : []),
        );
      }),
  );

  it.effect(
    "trims the committed name while reporting success and making the first template default",
    () =>
      Effect.gen(function* () {
        expect(yield* CreateTemplate({ id: "new", name: "  Study  " }).effect).toEqual(
          Message.TemplateCreated(),
        );
        expect(commit).toHaveBeenCalledWith({
          name: "v3.TemplateCreated",
          args: { id: "new", name: "Study", isDefault: true, now: expect.any(Date) },
        });
      }),
  );
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
  it.effect.each([
    () => CreateTemplate({ id: "new", name: "Study" }),
    () => EnsureTemplatesSeeded({}),
    () => AddSampleTemplates({}),
  ])("reports query failures without committing", (command) =>
    Effect.gen(function* () {
      query.mockImplementation(() => {
        throw new Error("Query failed");
      });
      expect(yield* command().effect).toMatchObject({
        _tag: "FailedTemplateOp",
      });
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("seeds the three sample templates when the app is empty", () =>
    Effect.gen(function* () {
      expect(yield* EnsureTemplatesSeeded({}).effect).toEqual(Message.TemplatesSeededCheck());
      expect(seededTemplates().map((t: { name: string }) => t.name)).toEqual([
        "Assembly line",
        "Ward round",
        "Warehouse pick",
      ]);
    }),
  );

  it.effect("skips seeding when templates already exist", () =>
    Effect.gen(function* () {
      query.mockReturnValue([{ id: "existing" }]);
      expect(yield* EnsureTemplatesSeeded({}).effect).toEqual(Message.TemplatesSeededCheck());
      expect(commit).not.toHaveBeenCalled();
    }),
  );
});

describe("AddSampleTemplates", () => {
  it.effect("adds only the samples whose names are missing and keeps the current default", () =>
    Effect.gen(function* () {
      query.mockReturnValue([{ name: "Ward round" }, { name: "My own study" }]);
      expect(yield* AddSampleTemplates({}).effect).toEqual(Message.SampleTemplatesAdded());
      expect(seededTemplates().map((t: { name: string }) => t.name)).toEqual([
        "Assembly line",
        "Warehouse pick",
      ]);
      expect(seededTemplates().every((t: { isDefault: boolean }) => !t.isDefault)).toBe(true);
    }),
  );

  it.effect("commits nothing when every sample is already there", () =>
    Effect.gen(function* () {
      query.mockReturnValue(sampleTemplates().map((template) => ({ name: template.name })));
      expect(yield* AddSampleTemplates({}).effect).toEqual(Message.SampleTemplatesAdded());
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("makes the first sample the default when the app has no templates", () =>
    Effect.gen(function* () {
      expect(yield* AddSampleTemplates({}).effect).toEqual(Message.SampleTemplatesAdded());
      expect(seededTemplates().map((t: { isDefault: boolean }) => t.isDefault)).toEqual([
        true,
        false,
        false,
      ]);
    }),
  );
});
