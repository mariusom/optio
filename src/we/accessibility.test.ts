import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { describe, expect, it } from "vitest";

import type { Message } from "../messages";
import { editSessionNameSheet } from "./features/history/editSessionNameSheet";
import { historyPage } from "./features/history/historyView";
import { taskDetailView } from "./features/history/taskDetailView";
import type { RunnerState } from "./features/session/runner";
import { endConfirmModal, errorAlert, formSectionsView } from "./features/session/runnerView";
import { startView } from "./features/session/startView";
import type { EditorState } from "./features/templates/editor";
import { templateEditorPage } from "./features/templates/editorView";
import { templatesPage } from "./features/templates/view";

// These tests inspect VNodes without dispatching messages.
const h = inertHtml as unknown as HtmlBuilder<Message>;
type Node = NonNullable<ReturnType<typeof h.div>>;
const nodes = (node: Node | null): Node[] =>
  node === null
    ? []
    : [
        node,
        ...(node.children ?? []).flatMap((child) =>
          typeof child === "object" ? nodes(child) : [],
        ),
      ];

const field = {
  id: "field-1",
  name: "Observed",
  kind: "boolean" as const,
  isRequired: false,
  defaultValue: "false",
  sortOrder: 0,
  options: [],
  exclusiveOptions: [],
};
const editor: EditorState = {
  id: "template-1",
  name: "Study",
  isDefault: false,
  fields: [field],
  original: { name: "Study", isDefault: false, fields: [field] },
  isSaving: false,
  showAddField: true,
  editingFieldId: field.id,
  draft: { ...field, newOptionText: "" },
  pendingDiscard: true,
};
const runner: RunnerState = {
  sessionId: "session-1",
  templateName: "Study",
  sessionName: "Session",
  startedAt: 0,
  now: 1000,
  currentTaskId: "task-1",
  completedCount: 0,
  tasks: [
    {
      id: "task-1",
      orderIndex: 1,
      endDate: null,
      isBeingEdited: false,
      sections: [field, { ...field, id: "field-2" }].map((f) => ({
        ...f,
        taskId: "task-1",
        value: "false",
        startDate: null,
      })),
    },
  ],
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: false,
  showEndConfirm: true,
  lastError: null,
  editBackup: null,
};
const editSheet = () =>
  editSessionNameSheet(
    {
      showEditHistoryName: true,
      editHistoryNameInput: "",
      selectedHistorySession: null,
    },
    h,
  );

describe("audited view accessibility", () => {
  it("names every modal backdrop while retaining click dismissal", () => {
    const views = [
      templatesPage(
        {
          templates: [],
          showCreate: true,
          newName: "",
          pendingDelete: { id: "t", name: "T" },
          lastError: null,
        },
        h,
      ),
      templateEditorPage({ editor, lastError: null }, h),
      historyPage(
        {
          history: [],
          pendingHistoryDelete: { id: "s", displayName: "S" },
          historyActionsFor: null,
          csvError: null,
        },
        h,
      ),
      editSheet(),
      startView(
        {
          templates: [],
          selectedTemplateId: null,
          sessionNameInput: "",
          placeholderName: "S",
          pendingDiscardSession: true,
          activeSession: {
            id: "s",
            templateId: null,
            templateName: "T",
            sessionName: "S",
            startedAt: 0,
            completedCount: 0,
          },
        },
        h,
      ),
      endConfirmModal(runner, h),
    ];
    const backdrops = views.flatMap(nodes).filter((n) => n.data?.class?.["modal-backdrop"]);
    // Creation and question editing are inline; only confirmations/actions are modal.
    expect(backdrops).toHaveLength(6);
    for (const backdrop of backdrops) {
      expect(backdrop.sel).toBe("button");
      expect(backdrop.data?.attrs?.["aria-label"]).toEqual(expect.any(String));
      expect(backdrop.data?.attrs?.["aria-label"]).not.toBe("");
      expect(backdrop.data?.on?.click).toBeTypeOf("function");
    }
  });

  it("provides named modal roles and describes the interrupting error", () => {
    const details = taskDetailView(
      { task: { id: "t", taskId: 1, startedAt: null, endedAt: null, sections: [] } },
      h,
    );
    // Sheets take their accessible name from the visible title.
    for (const [view, title] of [
      [editSheet(), "Session name"],
      [details, "Task 1"],
      [endConfirmModal(runner, h), "End session?"],
    ] as const) {
      expect(view?.data?.attrs?.role).toBe("dialog");
      expect(view?.data?.attrs?.["aria-modal"]).toBeTruthy();
      const titleId = view?.data?.attrs?.["aria-labelledby"];
      expect(titleId).toEqual(expect.any(String));
      expect(nodes(view).find((n) => n.data?.props?.id === titleId)?.children).toContainEqual(
        expect.objectContaining({ text: title }),
      );
    }
    // The live session reports failures inline, next to the action they block.
    const error = errorAlert("Cannot save", h);
    expect(error?.data?.attrs?.role).toBe("alert");
    expect(nodes(error).flatMap((n) => n.children ?? [])).toContainEqual(
      expect.objectContaining({ text: "Cannot save" }),
    );
    expect(
      nodes(error).find((n) => n.data?.attrs?.["aria-label"] === "Dismiss error")?.data?.on?.click,
    ).toBeTypeOf("function");
  });

  it("associates the visible name label with the edit-session textbox", () => {
    const all = nodes(editSheet());
    const input = all.find((n) => n.sel === "input");
    expect(input?.data?.props?.id).toBe("edit-session-name");
    expect(all.find((n) => n.sel === "label")?.data?.props?.htmlFor).toBe(input?.data?.props?.id);
  });

  it("names every question control with the question it acts on", () => {
    const all = nodes(templateEditorPage({ editor, lastError: null }, h));
    for (const label of [
      "Edit question Observed",
      "Move Observed up",
      "Move Observed down",
      "Delete question Observed",
    ]) {
      const controls = all.filter(
        (n) => n.sel === "button" && n.data?.attrs?.["aria-label"] === label,
      );
      expect(controls).toHaveLength(1);
    }
  });

  it("labels every switch in the template editor with its own clickable label", () => {
    const textEditor = { ...editor, draft: { ...editor.draft!, kind: "textInput" as const } };
    for (const view of [
      templateEditorPage({ editor, lastError: null }, h),
      templateEditorPage({ editor: textEditor, lastError: null }, h),
    ]) {
      const all = nodes(view);
      const switches = all.filter((n) => n.data?.attrs?.role === "switch");
      expect(switches).toHaveLength(2);
      for (const control of switches) {
        expect(control.sel).toBe("button");
        expect(control.data?.props?.type).toBe("button");
        const labelId = control.data?.attrs?.["aria-labelledby"];
        expect(labelId).toEqual(expect.any(String));
        const labels = all.filter((n) => n.sel === "label" && n.data?.props?.id === labelId);
        expect(labels).toHaveLength(1);
        expect(labels[0]?.data?.on?.click).toBeTypeOf("function");
      }
    }
  });

  it("uses native named button controls for dropdown action triggers", () => {
    const session = {
      id: "session-1",
      displayName: "Morning study",
      templateName: "Study",
      sessionName: "Morning study",
      startedAt: 0,
      endedAt: 1000,
      taskCount: 1,
    };
    const cases = [
      {
        view: templatesPage(
          {
            templates: [
              {
                id: "template-1",
                name: "Study",
                isDefault: false,
                fieldCount: 1,
                requiredCount: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            ],
            showCreate: false,
            newName: "",
            pendingDelete: null,
            lastError: null,
          },
          h,
        ),
        name: 'Actions for "Study"',
      },
      {
        view: historyPage(
          {
            history: [session],
            pendingHistoryDelete: null,
            historyActionsFor: null,
            csvError: null,
          },
          h,
        ),
        name: 'Actions for "Morning study"',
      },
    ];

    for (const { view, name } of cases) {
      const triggers = nodes(view).filter((node) => node.data?.attrs?.["aria-label"] === name);
      expect(triggers.length).toBeGreaterThan(0);
      for (const trigger of triggers) {
        expect(trigger.sel).toBe("button");
        expect(trigger.data?.props?.type).toBe("button");
        expect(trigger.data?.attrs?.tabindex).toBeUndefined();
      }
    }
  });

  it("labels each yes/no answer switch in the live session", () => {
    const all = nodes(formSectionsView(runner, runner.tasks[0]!, h));
    const switches = all.filter((n) => n.data?.attrs?.role === "switch");
    expect(switches).toHaveLength(2);
    for (const control of switches) {
      const labelId = control.data?.attrs?.["aria-labelledby"];
      expect(labelId).toEqual(expect.any(String));
      const labels = all.filter((n) => n.sel === "label" && n.data?.props?.id === labelId);
      expect(labels).toHaveLength(1);
      expect(labels[0]?.children).toContainEqual(expect.objectContaining({ text: "No" }));
      expect(labels[0]?.data?.on?.click).toBeTypeOf("function");
      expect(control.data?.props?.type).toBe("button");
    }
  });
});
