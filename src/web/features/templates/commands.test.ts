import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { afterEach, beforeEach, vi } from "vite-plus/test";

import { getStore, type AppStore } from "../../../store/client";
import { events } from "../../../store/schema";
import { Message } from "../../../messages";
import { SaveTemplate } from "./editorCommands";
import {
  AddSampleTemplates,
  CreateTemplate,
  EnsureTemplatesSeeded,
  SetDefaultTemplate,
  sampleTemplates,
} from "./commands";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));

const query = vi.fn();
const commit = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  query.mockReturnValue([]);
  commit.mockReturnValue(Effect.void);
  vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);
});

afterEach(() => vi.restoreAllMocks());

const seededTemplates = () => commit.mock.calls[0]?.[0]?.args?.templates ?? [];

describe.each([
  [
    "create",
    () => CreateTemplate.make({ id: "new", name: "Study" }),
    Message.SucceededCreateTemplate(),
    "Couldn't create that. Please try again.",
  ],
  [
    "set default",
    () => SetDefaultTemplate.make({ id: "existing" }),
    Message.SucceededSetDefaultTemplate(),
    "Couldn't save that. Please try again.",
  ],
  [
    "seed",
    () => EnsureTemplatesSeeded.make({}),
    Message.SucceededEnsureTemplatesSeeded(),
    "Couldn't create that. Please try again.",
  ],
  [
    "add samples",
    () => AddSampleTemplates.make({}),
    Message.SucceededAddSampleTemplates(),
    "Couldn't create that. Please try again.",
  ],
] as const)("%s template persistence", (_name, command, success, failure) => {
  it.effect("reports success only after committing", () =>
    Effect.gen(function* () {
      const message = yield* command().effect;
      expect(message).toEqual(success);
      expect(commit).toHaveBeenCalledOnce();
    }),
  );

  it.effect("reports a rejected store open in plain language, never a stack trace", () =>
    Effect.gen(function* () {
      vi.mocked(getStore).mockRejectedValue(new Error("Store unavailable"));
      const message = yield* command().effect;
      expect(message).toEqual(Message.FailedTemplateOp({ error: failure }));
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("reports a synchronous persistence failure in plain language", () =>
    Effect.gen(function* () {
      commit.mockImplementation(() => {
        throw new Error("Persistence failed");
      });
      const message = yield* command().effect;
      expect(message).toEqual(Message.FailedTemplateOp({ error: failure }));
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
        const message = yield* SaveTemplate.make({
          id: "new",
          name: "  Study  ",
          isNew: true,
          isDefault: false,
          fields,
        }).effect;
        expect(message).toEqual(Message.SucceededSaveTemplate());
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
        const message = yield* CreateTemplate.make({ id: "new", name: "  Study  " }).effect;
        expect(message).toEqual(Message.SucceededCreateTemplate());
        expect(commit).toHaveBeenCalledWith({
          name: "v3.TemplateCreated",
          args: { id: "new", name: "Study", isDefault: true, now: expect.any(Date) },
        });
      }),
  );
});

describe("sampleTemplates", () => {
  it("offers one showcase study per setting, only the first being the default", () => {
    expect(sampleTemplates(() => crypto.randomUUID()).map((template) => template.name)).toEqual([
      "Assembly line",
      "Ward round",
      "Warehouse pick",
      "Packing measurements",
    ]);
    expect(
      sampleTemplates(() => crypto.randomUUID()).map((template) => template.isDefault),
    ).toEqual([true, false, false, false]);
  });

  it("uses every answer type, with one choice that clears the others", () => {
    for (const template of sampleTemplates(() => crypto.randomUUID()).slice(0, 3)) {
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

  it("demonstrates quantitative answers and required unanswered Yes/No", () => {
    const demo = sampleTemplates(() => crypto.randomUUID()).find(
      (t) => t.name === "Packing measurements",
    )!;
    expect(demo.fields.map((f) => f.kind)).toEqual(["number", "counter", "rating", "boolean"]);
    expect(demo.fields.map((f) => f.defaultValue)).toEqual(["", "", "", ""]);
    expect(demo.fields.every((f) => f.isRequired)).toBe(true);
  });
});

describe("template queries", () => {
  it.effect.each([
    () => CreateTemplate.make({ id: "new", name: "Study" }),
    () => EnsureTemplatesSeeded.make({}),
    () => AddSampleTemplates.make({}),
  ])("reports query failures without committing", (command) =>
    Effect.gen(function* () {
      query.mockImplementation(() => {
        throw new Error("Query failed");
      });
      const message = yield* command().effect;
      expect(message).toMatchObject({
        _tag: "FailedTemplateOp",
      });
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("seeds the four sample templates when the app is empty", () =>
    Effect.gen(function* () {
      const message = yield* EnsureTemplatesSeeded.make({}).effect;
      expect(message).toEqual(Message.SucceededEnsureTemplatesSeeded());
      expect(seededTemplates().map((t: { name: string }) => t.name)).toEqual([
        "Assembly line",
        "Ward round",
        "Warehouse pick",
        "Packing measurements",
      ]);
    }),
  );

  it.effect("skips seeding when templates already exist", () =>
    Effect.gen(function* () {
      query.mockReturnValue([{ id: "existing" }]);
      const message = yield* EnsureTemplatesSeeded.make({}).effect;
      expect(message).toEqual(Message.SucceededEnsureTemplatesSeeded());
      expect(commit).not.toHaveBeenCalled();
    }),
  );
});

describe("AddSampleTemplates", () => {
  it.effect("adds only the samples whose names are missing and keeps the current default", () =>
    Effect.gen(function* () {
      query.mockReturnValue([{ name: "Ward round" }, { name: "My own study" }]);
      const message = yield* AddSampleTemplates.make({}).effect;
      expect(message).toEqual(Message.SucceededAddSampleTemplates());
      expect(seededTemplates().map((t: { name: string }) => t.name)).toEqual([
        "Assembly line",
        "Warehouse pick",
        "Packing measurements",
      ]);
      expect(seededTemplates().every((t: { isDefault: boolean }) => !t.isDefault)).toBe(true);
    }),
  );

  it.effect("commits nothing when every sample is already there", () =>
    Effect.gen(function* () {
      query.mockReturnValue(
        sampleTemplates(() => crypto.randomUUID()).map((template) => ({ name: template.name })),
      );
      const message = yield* AddSampleTemplates.make({}).effect;
      expect(message).toEqual(Message.SucceededAddSampleTemplates());
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("makes the first sample the default when the app has no templates", () =>
    Effect.gen(function* () {
      const message = yield* AddSampleTemplates.make({}).effect;
      expect(message).toEqual(Message.SucceededAddSampleTemplates());
      expect(seededTemplates().map((t: { isDefault: boolean }) => t.isDefault)).toEqual([
        true,
        false,
        false,
        false,
      ]);
    }),
  );
});
