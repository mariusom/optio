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
        { history: [], pendingHistoryDelete: { id: "s", displayName: "S" }, csvError: null },
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
      errorAlert("Cannot save", h),
    ];
    const backdrops = views.flatMap(nodes).filter((n) => n.data?.class?.["modal-backdrop"]);
    expect(backdrops).toHaveLength(9);
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
    for (const [view, role, name] of [
      [editSheet(), "dialog", "Edit Session"],
      [endConfirmModal(runner, h), "dialog", "End Session"],
      [errorAlert("Cannot save", h), "alertdialog", "Something Went Wrong"],
      [details, "dialog", "Task Details"],
    ] as const) {
      expect(view?.data?.attrs).toMatchObject({ role, "aria-modal": "true", "aria-label": name });
    }
    const error = errorAlert("Cannot save", h);
    expect(
      nodes(error).find((n) => n.data?.props?.id === error?.data?.attrs?.["aria-describedby"])
        ?.children,
    ).toContainEqual(expect.objectContaining({ text: "Cannot save" }));
  });

  it("associates the visible name label with the edit-session textbox", () => {
    const all = nodes(editSheet());
    const input = all.find((n) => n.sel === "input");
    expect(input?.data?.props?.id).toBe("edit-session-name");
    expect(all.find((n) => n.sel === "label")?.data?.attrs?.for).toBe(input?.data?.props?.id);
  });

  it("names both field edit controls with the field name", () => {
    const buttons = nodes(templateEditorPage({ editor, lastError: null }, h)).filter(
      (n) => n.sel === "button" && n.data?.attrs?.["aria-label"] === "Edit field Observed",
    );
    expect(buttons).toHaveLength(2);
  });

  it("associates each switch with its clickable label using unique input IDs", () => {
    const textEditor = { ...editor, draft: { ...editor.draft!, kind: "textInput" as const } };
    for (const [view, count] of [
      [templateEditorPage({ editor, lastError: null }, h), 2],
      [templateEditorPage({ editor: textEditor, lastError: null }, h), 2],
      [formSectionsView(runner, runner.tasks[0]!, h), 2],
    ] as const) {
      const all = nodes(view);
      const switches = all.filter((n) => n.data?.attrs?.role === "switch");
      expect(switches).toHaveLength(count);
      for (const control of switches) {
        const id = control.data?.props?.id;
        expect(id).toEqual(expect.any(String));
        expect(all.filter((n) => n.data?.props?.id === id)).toHaveLength(1);
        expect(all.filter((n) => n.sel === "label" && n.data?.attrs?.for === id)).toHaveLength(1);
        expect(control.data?.props?.type).toBe("checkbox");
      }
    }
  });
});
