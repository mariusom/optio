import { Effect, Option } from "effect";
import * as Scene from "foldkit/scene";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    rows: [[{ id: "session", endedAt: null }], [task]],
    success: "SessionEnded",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "EndSession archive",
    command: () => EndSession({ sessionId: "session" }),
    rows: [[{ id: "session", endedAt: null }], [finishedTask], []],
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
    rows: [[task, { ...finishedTask, id: "edited", isBeingEdited: 1 }]],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "CancelEdit",
    command: () => CancelEdit({ taskId: "task", backup: { field: "original" } }),
    rows: [],
    success: "TaskEditFinished",
    failure: "FailedRunnerOp",
    writes: true,
  },
  {
    name: "SaveEdit",
    command: () => SaveEdit({ taskId: "task" }),
    rows: [],
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

describe.each(cases)("$name persistence", ({ name, command, rows, success, failure, writes }) => {
  beforeEach(() => {
    for (const result of rows) query.mockReturnValueOnce(result);
  });

  it("returns its success message after store operations", async () => {
    expect(await Effect.runPromise<Message, never>(command().effect)).toMatchObject({
      _tag: success,
    });
    expect(query).toHaveBeenCalledTimes(rows.length);
    expect(commit).toHaveBeenCalledTimes(writes ? 1 : 0);
  });

  it.each(["open", ...(writes ? ["commit"] : []), ...rows.map((_, index) => index)])(
    "converts failure at %s into its declared UI message",
    async (stage) => {
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
      expect(await Effect.runPromise<Message, never>(command().effect)).toMatchObject({
        _tag: failure,
        error:
          name === "DeleteHistorySession"
            ? "Failed to delete session. Please try again."
            : expect.stringContaining(error.message),
      });
      expect(commit).toHaveBeenCalledTimes(stage === "commit" ? 1 : 0);
      if (stage === "open") expect(query).not.toHaveBeenCalled();
    },
  );
});

describe("template save failure recovery", () => {
  it.each(["open", "commit"])("resets saving and retains edits after %s failure", async (stage) => {
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
      Scene.expect(Scene.role("button", { name: "Save template changes" })).toBeDisabled(),
    );
    const error = new Error("Save unavailable");
    if (stage === "open") vi.mocked(getStore).mockRejectedValue(error);
    else
      commit.mockImplementation(() => {
        throw error;
      });
    const command = saving.commands?.[0];
    expect(command).toBeDefined();
    const message = await Effect.runPromise(command!.effect);
    expect(message._tag).toBe("FailedTemplateOp");
    const recovered = update(saving.model, message);
    expect(recovered.model.editor).toEqual(model.editor);
    expect(recovered.model.lastError).toContain(error.message);
    expect(recovered.commands ?? []).toEqual([]);
    Scene.scene(
      { view: templateEditorPage, update },
      Scene.given(recovered.model),
      Scene.expect(Scene.role("button", { name: "Save template changes" })).toBeEnabled(),
    );
    expect(update(recovered.model, Message.ClickedSaveTemplate()).model.editor?.isSaving).toBe(
      true,
    );
  });
});
