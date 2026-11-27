import { Html } from "@effect/ui/html";
import { HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import type { H, Ui } from "@/lib/view";
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
import { ShowSheet } from "../components/app/sheet";

type Node = Locator.Node;

/** Renders a view in a scene; every message it sends comes out as an event. */
const render = (view: (h: H<Message>) => Ui | null) =>
  HtmlScene.start(
    Html.component({
      name: "AccessibilityFrame",
      model: Schema.Null,
      message: Message,
      events: Message,
    }).make({
      init: () => null,
      update: ($, message) => $.emit(message),
      view: (h) => view(h) ?? h.div,
    }),
    {},
  );
type Rendered = ReturnType<typeof render>;
const nodes = (scene: Rendered): ReadonlyArray<Node> => Locator.elements(scene.root);
/** An attribute, or the property the view sets in its place (such as `id`). */
const attr = (node: Node | undefined, name: string): string | undefined => {
  const value = node?.attrs?.[name] ?? node?.props?.[name];
  return typeof value === "string" || typeof value === "number" ? `${value}` : undefined;
};
/** The message an interaction on `locator` sends, acknowledged, or undefined. */
const sent = (scene: Rendered, locator: Locator.Locator, event: string, payload?: object) => {
  const before = scene.current.emitted.length;
  scene.fire(locator, event, payload);
  const message = scene.current.emitted[before];
  if (message === undefined) scene.expectIgnored();
  else scene.emitted(message);
  return message;
};

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
            templatesGrid: { query: "", sorting: [{ id: "name", desc: false }], filters: {} },
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
            historyGrid: { query: "", sorting: [{ id: "started", desc: true }], filters: {} },
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
    const dialogs = views.flatMap((view) =>
      nodes(view)
        .filter((n) => n.tag === "dialog")
        .map((dialog) => ({ view, dialog })),
    );
    // Creation and question editing are inline; only confirmations/actions are modal.
    expect(dialogs).toHaveLength(6);
    for (const { view, dialog } of dialogs) {
      // An open sheet runs its focus and scroll Mount.
      view.expectMount(ShowSheet({ id: attr(dialog, "id")! }));
      // Escape arrives as the dialog's cancel event; the backdrop is decorative.
      const escaped = sent(view, Locator.tag("dialog"), "cancel", { cancelable: true });
      expect(escaped).toBeDefined();
      // A request the browser won't let be cancelled closes the dialog itself:
      // the dismissal comes once, from `close`.
      expect(sent(view, Locator.tag("dialog"), "cancel", { cancelable: false })).toBeUndefined();
      expect(sent(view, Locator.tag("dialog"), "close", { returnValue: "" })).toEqual(escaped);
      const backdrop = Locator.elements(dialog).find((n) =>
        (attr(n, "class") ?? "").split(" ").includes("modal-backdrop"),
      );
      expect(backdrop?.tag).toBe("div");
      expect(sent(view, Locator.attr("data-slot", attr(backdrop, "data-slot")), "click")).toEqual(
        escaped,
      );
      // A named in-panel action always offers the same way out.
      expect(
        Locator.elements(dialog).some(
          (n) => n.tag === "button" && /^(Cancel|Continue|Keep)/.test(attr(n, "aria-label") ?? ""),
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
      const dialog = nodes(view).find((n) => n.tag === "dialog");
      expect(attr(dialog, "aria-modal")).toBeTruthy();
      const titleId = attr(dialog, "aria-labelledby");
      expect(titleId).toEqual(expect.any(String));
      const titleNode = nodes(view).find((n) => attr(n, "id") === titleId);
      expect(titleNode && Locator.textOf(titleNode)).toContain(title);
    }
    // The live session reports failures inline, next to the action they block.
    const error = render((frame) => errorAlert("Cannot save", frame));
    const alert = nodes(error).find((n) => attr(n, "role") === "alert");
    expect(alert && Locator.textOf(alert)).toContain("Cannot save");
    expect(sent(error, Locator.attr("aria-label", "Dismiss error"), "click")).toBeDefined();
  });

  it("associates the visible name label with the edit-session textbox", () => {
    const all = nodes(editSheet());
    const input = all.find((n) => n.tag === "input");
    expect(attr(input, "id")).toBe("edit-session-name-input");
    const label = all.find((n) => n.tag === "label");
    expect(attr(label, "for") ?? attr(label, "htmlFor")).toBe("edit-session-name-input");
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
        (n) => n.tag === "button" && (attr(n, "aria-label") ?? "").startsWith("Edit question"),
      ),
    ).toBe(false);
    for (const label of ["Move Observed up", "Move Observed down", "Delete question Observed"]) {
      const controls = all.filter((n) => n.tag === "button" && attr(n, "aria-label") === label);
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
      const switches = all.filter((n) => attr(n, "role") === "switch");
      expect(switches).toHaveLength(1);
      for (const control of switches) {
        expect(control.tag).toBe("button");
        expect(attr(control, "type")).toBe("button");
        // A native label names the button, and tapping it toggles the switch.
        const id = attr(control, "id");
        expect(id).toEqual(expect.any(String));
        const labels = all.filter((n) => n.tag === "label" && attr(n, "for") === id);
        expect(labels).toHaveLength(1);
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
        view: render((h) =>
          templatesPage(
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
              templatesGrid: { query: "", sorting: [{ id: "name", desc: false }], filters: {} },
            },
            h,
          ),
        ),
        name: 'Actions for "Study"',
      },
      {
        view: render((h) =>
          historyPage(
            {
              history: [session],
              now: session.startedAt,
              pendingHistoryDelete: null,
              historyActionsFor: null,
              historyError: null,
              historyGrid: { query: "", sorting: [{ id: "started", desc: true }], filters: {} },
            },
            h,
          ),
        ),
        name: 'Actions for "Morning study"',
      },
    ];

    for (const { view, name } of cases) {
      const triggers = nodes(view).filter((node) => attr(node, "aria-label") === name);
      expect(triggers.length).toBeGreaterThan(0);
      for (const trigger of triggers) {
        expect(trigger.tag).toBe("button");
        expect(attr(trigger, "type")).toBe("button");
        expect(attr(trigger, "tabindex")).toBeUndefined();
      }
    }
  });

  it("labels each yes/no answer group and its three states in the live session", () => {
    const all = nodes(render((h) => formSectionsView(runner.tasks[0]!, h)));
    const groups = all.filter(
      (n) => attr(n, "role") === "radiogroup" && attr(n, "aria-label") === "Observed",
    );
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const radios = Locator.elements(group).filter((n) => attr(n, "type") === "radio");
      expect(radios.map((n) => attr(n, "aria-label"))).toEqual(["Unanswered", "Yes", "No"]);
    }
  });
});
