import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { HtmlLocator } from "@effect/ui/html/testing";
import { beforeEach, vi } from "vite-plus/test";

import { getStore, type AppStore } from "../store/client";
import { init, update, type Model } from "../main";
import { Message } from "../messages";
import {
  CancelEdit,
  EndSession,
  RecordTask,
  SaveEdit,
  SelectTask,
  UpdateFieldValues,
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
import { viewScene } from "./features/viewScene";
import { runCommand } from "../app/testSubscriptions";

vi.mock("../store/client", () => ({ getStore: vi.fn() }));

const query = vi.fn();
const commit = vi.fn();
const task = { id: "task", orderIndex: 1, taskType: "single", endDate: null, isBeingEdited: 0 };
const finishedTask = { ...task, endDate: new Date(1000) };
const liveSession = { id: "session", endedAt: null };
const template = { id: "template", name: "Study", isDefault: 0, createdAt: new Date(0) };
const saveArgs = { id: "template", name: "Edited study", isDefault: false, fields: [] };

beforeEach(() => {
  vi.resetAllMocks();
  commit.mockReturnValue(Effect.void);
  vi.mocked(getStore).mockResolvedValue({ query, commit } as unknown as AppStore);
});

const cases = [
  {
    name: "UpdateFieldValues",
    command: () => UpdateFieldValues.make({ writes: [{ taskFieldId: "field", value: "x" }] }),
    rows: [[{ id: "field", taskId: "task" }], [task]],
    success: "UpdatedFieldValue",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "RecordTask",
    command: () => RecordTask.make({ sessionId: "session", currentTaskId: "task" }),
    rows: [[task], []],
    success: "TaskRecorded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "EndSession empty",
    command: () => EndSession.make({ sessionId: "session" }),
    rows: [[liveSession], [task]],
    success: "SessionEnded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "EndSession archive",
    command: () => EndSession.make({ sessionId: "session" }),
    rows: [[liveSession], [finishedTask], []],
    success: "SessionEnded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SelectTask finished",
    command: () => SelectTask.make({ sessionId: "session", taskId: "task" }),
    rows: [[finishedTask]],
    success: "TaskEditStarted",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SelectTask current",
    command: () => SelectTask.make({ sessionId: "session", taskId: "task" }),
    rows: [[task, { ...finishedTask, id: "edited", isBeingEdited: 1 }], []],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "CancelEdit",
    command: () => CancelEdit.make({ taskId: "task" }),
    rows: [],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SaveEdit",
    command: () => SaveEdit.make({ taskId: "task" }),
    rows: [[]],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "RenameHistorySession",
    command: () => RenameHistorySession.make({ id: "session", sessionName: "Edited" }),
    rows: [],
    success: "HistoryNameUpdated",
    failure: "FailedHistoryOp",
    writes: true,
  },
  {
    name: "DeleteHistorySession",
    command: () => DeleteHistorySession.make({ id: "session" }),
    rows: [],
    success: "HistoryDeleted",
    failure: "FailedHistoryOp",
    writes: true,
  },
  {
    name: "ExportSessionCsv",
    command: () => ExportSessionCsv.make({ sessionId: "session" }),
    // One combined read of the session, its records and their answers.
    rows: [
      {
        session: { id: "session", sessionName: "Study", templateName: "" },
        records: [{ id: "record", taskId: 1, startedAt: null, endedAt: null }],
        sections: [],
      },
    ],
    success: "CsvExported",
    failure: "FailedCsvExport",
    writes: false,
  },
  {
    name: "SaveTemplate",
    command: () => SaveTemplate.make(saveArgs),
    rows: [],
    success: "TemplateSaved",
    failure: "FailedTemplateOp",
    writes: true,
  },
  {
    name: "SaveTemplate default",
    command: () => SaveTemplate.make({ ...saveArgs, isDefault: true }),
    rows: [],
    success: "TemplateSaved",
    failure: "FailedTemplateOp",
    writes: true,
  },
  {
    name: "DuplicateTemplate",
    command: () => DuplicateTemplate.make({ id: "template" }),
    rows: [[template], []],
    success: "DuplicatedTemplate",
    failure: "FailedTemplateOp",
    writes: true,
  },
  {
    name: "DeleteTemplate",
    command: () => DeleteTemplate.make({ id: "template" }),
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
      const message = yield* command().effect;
      expect(message).toMatchObject({
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

describe("field writes", () => {
  it.effect.each([
    ["completed", finishedTask, 0],
    ["completed in edit mode", { ...finishedTask, isBeingEdited: 1 }, 1],
  ] as const)("late input on a %s task", ([, row, commits]) =>
    Effect.gen(function* () {
      query.mockReturnValueOnce([{ id: "field", taskId: "task" }]).mockReturnValueOnce([row]);
      const message = yield* UpdateFieldValues.make({
        writes: [{ taskFieldId: "field", value: "late" }],
      }).effect;
      expect(message).toMatchObject({ _tag: "UpdatedFieldValue" });
      expect(commit).toHaveBeenCalledTimes(commits);
    }),
  );
});

describe("batched field writes", () => {
  it.effect("commits a batch in one transaction and skips answers that became read-only", () =>
    Effect.gen(function* () {
      query
        .mockReturnValueOnce([{ id: "open", taskId: "task" }])
        .mockReturnValueOnce([task])
        .mockReturnValueOnce([{ id: "closed", taskId: "done" }])
        .mockReturnValueOnce([{ ...finishedTask, id: "done" }]);
      const result = yield* UpdateFieldValues.make({
        writes: [
          { taskFieldId: "open", value: "Observed" },
          { taskFieldId: "closed", value: "Late" },
        ],
      }).effect;
      expect(result).toMatchObject({ _tag: "UpdatedFieldValue" });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit.mock.calls[0]).toHaveLength(1);
      expect(commit.mock.calls[0]![0]).toMatchObject({ args: { id: "open", value: "Observed" } });
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
        return Effect.void;
      });
      yield* Effect.all(
        Array.from(
          { length: 12 },
          () => AdjustCounter.make({ taskFieldId: "field", delta: 1 }).effect,
        ),
        { concurrency: "unbounded" },
      );
      expect(value).toBe("19");
      yield* AdjustCounter.make({ taskFieldId: "field", delta: -1 }).effect;
      expect(value).toBe("18");
    }),
  );
  it.effect.each(["0", "-1", "2.5"])("does not decrement invalid or zero value %s", (value) =>
    Effect.gen(function* () {
      query.mockReturnValue([{ taskId: "task", kind: "counter", value, ...task }]);
      yield* AdjustCounter.make({ taskFieldId: "field", delta: -1 }).effect;
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
      const message = yield* SaveEdit.make({ taskId: "task" }).effect;
      expect(message).toMatchObject({
        _tag: "FailedRunnerOp",
      });
      expect(commit).not.toHaveBeenCalled();
    }),
  );
  it.effect("does not finish the edit when a persisted required field is empty", () =>
    Effect.gen(function* () {
      query.mockReturnValueOnce([{ isRequired: 1, value: "" }]);

      const message = yield* SaveEdit.make({ taskId: "task" }).effect;
      expect(message).toMatchObject({
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

      const message = yield* SaveEdit.make({ taskId: "task" }).effect;
      expect(message).toMatchObject({
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
        const message = yield* SelectTask.make({ sessionId: "session", taskId: target.id }).effect;
        expect(message).toMatchObject({
          _tag: "FailedRunnerOp",
          error: expect.stringContaining("correct invalid answers"),
        });
        expect(commit).not.toHaveBeenCalled();
      }
      query
        .mockReturnValueOnce([liveSession])
        .mockReturnValueOnce([finishedTask])
        .mockReturnValueOnce([field]);
      const message = yield* EndSession.make({ sessionId: "session" }).effect;
      expect(message).toMatchObject({
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

      const message = yield* EndSession.make({ sessionId: "session" }).effect;
      expect(message).toMatchObject({
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

      const first = yield* EndSession.make({ sessionId: "session" }).effect;
      expect(first).toMatchObject({
        _tag: "SessionEnded",
      });
      const second = yield* EndSession.make({ sessionId: "session" }).effect;
      expect(second).toMatchObject({
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
      const initial = init("#/templates/template").model;
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
      (yield* viewScene((h) => templateEditorPage(saving.model, h)))
        .expect(HtmlLocator.role("button", { name: "Save template" }))
        .toBeDisabled();
      const error = new Error("Save unavailable");
      if (stage === "open") vi.mocked(getStore).mockRejectedValue(error);
      else
        commit.mockImplementation(() => {
          throw error;
        });
      const command = saving.commands?.[0];
      // A failed save reports a Message, never a no-op.
      const message = (yield* runCommand(command!)) as Message;
      expect(message).toMatchObject({ _tag: "FailedTemplateOp" });
      const recovered = update(saving.model, message);
      expect(recovered.model.editor).toEqual(model.editor);
      expect(recovered.model.lastError).toBe("Couldn't save that. Please try again.");
      expect(recovered.commands ?? []).toEqual([]);
      (yield* viewScene((h) => templateEditorPage(recovered.model, h)))
        .expect(HtmlLocator.role("button", { name: "Save template" }))
        .toBeDisabled(false);
      expect(update(recovered.model, Message.ClickedSaveTemplate()).model.editor?.isSaving).toBe(
        true,
      );
    }),
  );
});
