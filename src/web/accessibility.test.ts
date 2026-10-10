import { inertHtml, type Html, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { ShowSheet } from "../components/app/sheet";
import { Message } from "../messages";
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
/** Renders views that embed sheets, which need a runtime frame and settle their show Mounts. */
const render = (view: (h: HtmlBuilder<Message>) => Html): Node | null => {
  let rendered: Html = null;
  Scene.scene(
    {
      update: (model: null, _message: Message) => ({ model }),
      view: (_model: null, frame) => view(frame),
    },
    Scene.given(null),
    (simulation: Scene.SceneSimulation<null, Message>) =>
      Scene.Mount.resolveAll(
        ...simulation.mounts.map(() => [ShowSheet, Message.SettledSheet()] as const),
      )(simulation),
    (simulation: Scene.SceneSimulation<null, Message>) => {
      rendered = simulation.html;
      return simulation;
    },
  );
  return rendered;
};
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
  fieldWrites: { revision: 0, pending: [] },
  announcement: null,
};
const editSheet = () =>
  render((frame) =>
    editSessionNameSheet(
      {
        showEditHistoryName: true,
        editHistoryNameInput: "",
        selectedHistorySession: null,
      },
      frame,
    ),
  );

describe("audited view accessibility", () => {
  it("dismisses every modal from its backdrop and Escape", () => {
    const views = [
      render((frame) =>
        templatesPage(
          {
            templates: [],
            showCreate: true,
            newName: "",
            pendingDelete: { id: "t", name: "T" },
            lastError: null,
          },
          frame,
        ),
      ),
      render((frame) => templateEditorPage({ editor, lastError: null }, frame)),
      render((frame) =>
        historyPage(
          {
            history: [],
            now: 0,
            pendingHistoryDelete: { id: "s", displayName: "S" },
            historyActionsFor: null,
            historyError: null,
          },
          frame,
        ),
      ),
      editSheet(),
      render((frame) =>
        startView(
          {
            templates: [],
            selectedTemplateId: null,
            sessionNameInput: "",
            placeholderName: "S",
            pendingDiscardSession: true,
            now: 0,
            activeSession: {
              id: "s",
              templateId: null,
              templateName: "T",
              sessionName: "S",
              startedAt: 0,
              completedCount: 0,
            },
          },
          frame,
        ),
      ),
      render((frame) => endConfirmModal(runner, frame)),
    ];
    const dialogs = views.flatMap(nodes).filter((n) => n.sel?.startsWith("dialog"));
    // Creation and question editing are inline; only confirmations/actions are modal.
    expect(dialogs).toHaveLength(6);
    for (const dialog of dialogs) {
      // Escape arrives as the dialog's cancel event; the backdrop is decorative.
      expect(dialog.data?.on?.cancel).toBeTypeOf("function");
      const backdrop = nodes(dialog).find((n) => n.data?.class?.["modal-backdrop"]);
      expect(backdrop?.sel).toBe("div");
      expect(backdrop?.data?.on?.click).toBeTypeOf("function");
      // A named in-panel action always offers the same way out.
      expect(
        nodes(dialog).some(
          (n) =>
            n.sel === "button" &&
            /^(Cancel|Continue|Keep)/.test(String(n.data?.attrs?.["aria-label"] ?? "")),
        ),
      ).toBe(true);
    }
  });

  it("provides named modal roles and describes the interrupting error", () => {
    const details = render((frame) =>
      taskDetailView(
        { task: { id: "t", taskId: 1, startedAt: null, endedAt: null, sections: [] } },
        frame,
      ),
    );
    // Sheets take their accessible name from the visible title.
    for (const [view, title] of [
      [editSheet(), "Session name"],
      [details, "Task 1"],
      [render((frame) => endConfirmModal(runner, frame)), "End session?"],
    ] as const) {
      expect(view?.sel).toBe("dialog");
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
    const all = [
      ...nodes(render((frame) => templateEditorPage({ editor, lastError: null }, frame))),
      ...nodes(
        render((frame) =>
          templateEditorPage({ editor: { ...editor, draft: null }, lastError: null }, frame),
        ),
      ),
    ];
    // The edit row is named by its visible text, not an aria-label (WCAG 2.5.3).
    expect(
      all.some(
        (n) =>
          n.sel === "button" &&
          String(n.data?.attrs?.["aria-label"] ?? "").startsWith("Edit question"),
      ),
    ).toBe(false);
    for (const label of ["Move Observed up", "Move Observed down", "Delete question Observed"]) {
      const controls = all.filter(
        (n) => n.sel === "button" && n.data?.attrs?.["aria-label"] === label,
      );
      expect(controls).toHaveLength(1);
    }
  });

  it("labels every switch in the template editor with its own clickable label", () => {
    const textEditor = { ...editor, draft: { ...editor.draft!, kind: "textInput" as const } };
    for (const view of [
      render((frame) =>
        templateEditorPage({ editor: { ...editor, draft: null }, lastError: null }, frame),
      ),
      render((frame) => templateEditorPage({ editor, lastError: null }, frame)),
      render((frame) => templateEditorPage({ editor: textEditor, lastError: null }, frame)),
    ]) {
      const all = nodes(view);
      const switches = all.filter((n) => n.data?.attrs?.role === "switch");
      expect(switches).toHaveLength(1);
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
            now: session.startedAt,
            pendingHistoryDelete: null,
            historyActionsFor: null,
            historyError: null,
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

  it("labels each yes/no answer group and its three states in the live session", () => {
    const all = nodes(formSectionsView(runner.tasks[0]!, h));
    const groups = all.filter(
      (n) => n.data?.attrs?.role === "radiogroup" && n.data?.attrs?.["aria-label"] === "Observed",
    );
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const radios = nodes(group).filter((n) => n.data?.props?.type === "radio");
      expect(radios.map((n) => n.data?.attrs?.["aria-label"])).toEqual(["Unanswered", "Yes", "No"]);
    }
  });
});
