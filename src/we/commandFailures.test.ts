import { Effect, Option } from "effect";
import { describe, expect, it } from "@effect/vitest";
import * as Scene from "foldkit/scene";
import { beforeEach, vi } from "vitest";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore, type AppStore } from "../livestore/client";
import { init, update, type Model } from "../main";
import { Message } from "../messages";
import {
  CancelEdit,
  EndSession,
  RecordTask,
  SaveEdit,
  SelectTask,
  UpdateFieldValue,
  AdjustCounter,
} from "./features/session/runnerCommands";
import {
  DeleteHistorySession,
  ExportSessionCsv,
  RenameHistorySession,
} from "./features/history/historyCommands";
import { DeleteTemplate, DuplicateTemplate } from "./features/templates/commands";
import { SaveTemplate } from "./features/templates/editorCommands";
import { templateEditorPage } from "./features/templates/editorView";

const query = vi.fn();
const commit = vi.fn();
const task = { id: "task", orderIndex: 1, endDate: null, isBeingEdited: 0 };
const finishedTask = { ...task, endDate: new Date(1000) };
const liveSession = { id: "session", endedAt: null };
const template = { id: "template", name: "Study", isDefault: 0, createdAt: new Date(0) };
const saveArgs = { id: "template", name: "Edited study", isDefault: false, fields: [] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);
});

const cases = [
  {
    name: "UpdateFieldValue",
    command: () => UpdateFieldValue({ taskFieldId: "field", value: "x" }),
    rows: [],
    success: "UpdatedFieldValue",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "RecordTask",
    command: () => RecordTask({ sessionId: "session", currentTaskId: "task" }),
    rows: [[task], []],
    success: "TaskRecorded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "EndSession empty",
    command: () => EndSession({ sessionId: "session" }),
    rows: [[liveSession], [task]],
    success: "SessionEnded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "EndSession archive",
    command: () => EndSession({ sessionId: "session" }),
    rows: [[liveSession], [finishedTask], []],
    success: "SessionEnded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SelectTask finished",
    command: () => SelectTask({ sessionId: "session", taskId: "task" }),
    rows: [[finishedTask]],
    success: "TaskEditStarted",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SelectTask current",
    command: () => SelectTask({ sessionId: "session", taskId: "task" }),
    rows: [[task, { ...finishedTask, id: "edited", isBeingEdited: 1 }], []],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "CancelEdit",
    command: () => CancelEdit({ taskId: "task" }),
    rows: [],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SaveEdit",
    command: () => SaveEdit({ taskId: "task" }),
    rows: [[]],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "RenameHistorySession",
    command: () => RenameHistorySession({ id: "session", sessionName: "Edited" }),
    rows: [],
    success: "HistoryNameUpdated",
    failure: "FailedCsvExport",
    writes: true,
  },
  {
    name: "DeleteHistorySession",
    command: () => DeleteHistorySession({ id: "session" }),
    rows: [],
    success: "HistoryDeleted",
    failure: "FailedCsvExport",
    writes: true,
  },
  {
    name: "ExportSessionCsv",
    command: () => ExportSessionCsv({ sessionId: "session" }),
    rows: [
      [{ id: "session", sessionName: "Study" }],
      [{ id: "record", taskId: 1, startedAt: null, endedAt: null }],
      [],
    ],
    success: "CsvExported",
    failure: "FailedCsvExport",
    writes: false,
  },
  {
    name: "SaveTemplate",
    command: () => SaveTemplate(saveArgs),
    rows: [],
    success: "TemplateSaved",
    failure: "FailedTemplateOp",
    writes: true,
  },
  {
    name: "SaveTemplate default",
    command: () => SaveTemplate({ ...saveArgs, isDefault: true }),
    rows: [],
    success: "TemplateSaved",
    failure: "FailedTemplateOp",
    writes: true,
  },
  {
    name: "DuplicateTemplate",
    command: () => DuplicateTemplate({ id: "template" }),
    rows: [[template], []],
    success: "DuplicatedTemplate",
    failure: "FailedTemplateOp",
    writes: true,
  },
  {
    name: "DeleteTemplate",
    command: () => DeleteTemplate({ id: "template" }),
    rows: [[template]],
    success: "TemplateOpDone",
    failure: "FailedTemplateOp",
    writes: true,
  },
] as const;

describe.each(cases)("$name persistence", ({ command, rows, success, failure, writes }) => {
  beforeEach(() => {
    for (const result of rows) query.mockReturnValueOnce(result);
  });

  it.effect("returns its success message after store operations", () =>
    Effect.gen(function* () {
      expect(yield* command().effect).toMatchObject({
        _tag: success,
      });
      expect(query).toHaveBeenCalledTimes(rows.length);
      expect(commit).toHaveBeenCalledTimes(writes ? 1 : 0);
    }),
  );

  it.effect.each(["open", ...(writes ? ["commit"] : []), ...rows.map((_, index) => index)])(
    "converts failure at %s into its declared UI message",
    (stage) =>
      Effect.gen(function* () {
        const error = new Error("Store operation failed");
        if (stage === "open") vi.mocked(getStore).mockRejectedValue(error);
        else if (stage === "commit")
          commit.mockImplementation(() => {
            throw error;
          });
        else {
          query.mockReset();
          rows.forEach((result, index) => {
            query.mockImplementationOnce(() => {
              if (index === stage) throw error;
              return result;
            });
          });
        }
        const message = yield* command().effect;
        expect(message).toMatchObject({ _tag: failure });
        // Users get one short sentence, never the raw cause or a stack trace.
        const reported = (message as { error: string }).error;
        expect(reported).toMatch(/^[A-Z].*\.$/);
        expect(reported).not.toContain(error.message);
        expect(reported).not.toContain("Error");
        expect(commit).toHaveBeenCalledTimes(stage === "commit" ? 1 : 0);
        if (stage === "open") expect(query).not.toHaveBeenCalled();
      }),
  );
});

describe("counter writes", () => {
  it.effect("reads the latest stored value for every rapid tap", () =>
    Effect.gen(function* () {
      let value = "7";
      query.mockImplementation(() => [
        { ...task, id: "field", taskId: "task", kind: "counter", value },
      ]);
      commit.mockImplementation((event) => {
        value = event.args.value;
      });
      yield* Effect.all(
        Array.from({ length: 12 }, () => AdjustCounter({ taskFieldId: "field", delta: 1 }).effect),
        { concurrency: "unbounded" },
      );
      expect(value).toBe("19");
      yield* AdjustCounter({ taskFieldId: "field", delta: -1 }).effect;
      expect(value).toBe("18");
    }),
  );
  it.effect.each(["0", "-1", "2.5"])("does not decrement invalid or zero value %s", (value) =>
    Effect.gen(function* () {
      query.mockReturnValue([{ taskId: "task", kind: "counter", value, ...task }]);
      yield* AdjustCounter({ taskFieldId: "field", delta: -1 }).effect;
      expect(commit).not.toHaveBeenCalled();
    }),
  );
});

describe("SaveEdit required field validation", () => {
  it.effect.each([
    ["number", "bad"],
    ["counter", "-1"],
    ["rating", "6"],
  ])("rejects invalid optional %s", ([kind, value]) =>
    Effect.gen(function* () {
      query.mockReturnValueOnce([{ kind, value, isRequired: 0 }]);
      expect(yield* SaveEdit({ taskId: "task" }).effect).toMatchObject({ _tag: "FailedRunnerOp" });
      expect(commit).not.toHaveBeenCalled();
    }),
  );
  it.effect("does not finish the edit when a persisted required field is empty", () =>
    Effect.gen(function* () {
      query.mockReturnValueOnce([{ isRequired: 1, value: "" }]);

      expect(yield* SaveEdit({ taskId: "task" }).effect).toMatchObject({
        _tag: "FailedRunnerOp",
        error: "Complete required questions and correct invalid answers first.",
      });
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("allows persisted optional fields to be empty", () =>
    Effect.gen(function* () {
      query.mockReturnValueOnce([
        { isRequired: 0, value: "" },
        { isRequired: 1, value: "complete" },
      ]);

      expect(yield* SaveEdit({ taskId: "task" }).effect).toMatchObject({
        _tag: "TaskEditFinished",
      });
      expect(commit).toHaveBeenCalledTimes(1);
    }),
  );
});

describe("EndSession idempotency", () => {
  it.effect.each([
    { kind: "number", value: "bad", isRequired: 0 },
    { kind: "counter", value: "-1", isRequired: 0 },
    { kind: "rating", value: "6", isRequired: 0 },
    { kind: "boolean", value: "", isRequired: 1 },
  ])("retains invalid edits instead of switching or archiving: %s", (field) =>
    Effect.gen(function* () {
      for (const target of [task, { ...finishedTask, id: "other" }]) {
        query.mockReturnValueOnce([target, { ...finishedTask, id: "edited", isBeingEdited: 1 }]);
        query.mockReturnValueOnce([field]);
        expect(yield* SelectTask({ sessionId: "session", taskId: target.id }).effect).toMatchObject(
          {
            _tag: "FailedRunnerOp",
            error: expect.stringContaining("correct invalid answers"),
          },
        );
        expect(commit).not.toHaveBeenCalled();
      }
      query
        .mockReturnValueOnce([liveSession])
        .mockReturnValueOnce([finishedTask])
        .mockReturnValueOnce([field]);
      expect(yield* EndSession({ sessionId: "session" }).effect).toMatchObject({
        _tag: "FailedRunnerOp",
        error: expect.stringContaining("correct invalid answers"),
      });
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect.each([
    ["missing", []],
    ["already ended", [{ ...liveSession, endedAt: new Date(2000) }]],
  ])("rejects a %s session without reading tasks or committing", ([_name, sessionRows]) =>
    Effect.gen(function* () {
      query.mockReturnValueOnce(sessionRows);

      expect(yield* EndSession({ sessionId: "session" }).effect).toMatchObject({
        _tag: "FailedRunnerOp",
        error: "This session has already ended.",
      });
      expect(query).toHaveBeenCalledTimes(1);
      expect(commit).not.toHaveBeenCalled();
    }),
  );

  it.effect("does not delete an archive when EndSession is repeated", () =>
    Effect.gen(function* () {
      query
        .mockReturnValueOnce([liveSession])
        .mockReturnValueOnce([finishedTask])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ ...liveSession, endedAt: new Date(2000) }]);

      expect(yield* EndSession({ sessionId: "session" }).effect).toMatchObject({
        _tag: "SessionEnded",
      });
      expect(yield* EndSession({ sessionId: "session" }).effect).toMatchObject({
        _tag: "FailedRunnerOp",
      });

      expect(query).toHaveBeenCalledTimes(4);
      expect(commit).toHaveBeenCalledTimes(1);
    }),
  );
});

describe("template save failure recovery", () => {
  it.effect.each(["open", "commit"])("resets saving and retains edits after %s failure", (stage) =>
    Effect.gen(function* () {
      const initial = init({
        protocol: "https:",
        host: "example.com",
        port: Option.none(),
        pathname: "/optio/",
        search: Option.none(),
        hash: Option.some("#/templates/template"),
      }).model;
      const model: Model = {
        ...initial,
        editor: {
          ...saveArgs,
          fields: [
            {
              id: "field",
              name: "Edited field",
              kind: "textInput",
              isRequired: true,
              defaultValue: "Draft value",
              sortOrder: 0,
              options: [],
              exclusiveOptions: [],
            },
          ],
          original: { name: "Original study", isDefault: false, fields: [] },
          isSaving: false,
          showAddField: false,
          editingFieldId: null,
          draft: null,
          pendingDiscard: false,
        },
      };
      const saving = update(model, Message.ClickedSaveTemplate());
      expect(saving.model.editor?.isSaving).toBe(true);
      Scene.scene(
        { view: templateEditorPage, update },
        Scene.given(saving.model),
        Scene.expect(Scene.role("button", { name: "Save template" })).toBeDisabled(),
      );
      const error = new Error("Save unavailable");
      if (stage === "open") vi.mocked(getStore).mockRejectedValue(error);
      else
        commit.mockImplementation(() => {
          throw error;
        });
      const command = saving.commands?.[0];
      expect(command).toBeDefined();
      const message = yield* command!.effect;
      expect(message._tag).toBe("FailedTemplateOp");
      const recovered = update(saving.model, message);
      expect(recovered.model.editor).toEqual(model.editor);
      expect(recovered.model.lastError).toBe("Couldn't save that. Please try again.");
      expect(recovered.commands ?? []).toEqual([]);
      Scene.scene(
        { view: templateEditorPage, update },
        Scene.given(recovered.model),
        Scene.expect(Scene.role("button", { name: "Save template" })).toBeEnabled(),
      );
      expect(update(recovered.model, Message.ClickedSaveTemplate()).model.editor?.isSaving).toBe(
        true,
      );
    }),
  );
});
