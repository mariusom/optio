import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Option } from "effect";
import { Runtime } from "foldkit";
import { fromString } from "foldkit/url";
import type {} from "@vitest/browser-playwright";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

import { init, Model, update } from "../main";
import { makeEmptyDraft, withKindChanged } from "./features/templates/editor";
import { templateEditorPage } from "./features/templates/editorView";
import { templatesPage } from "./features/templates/view";
import { historyPage } from "./features/history/historyView";
import { sessionDetailPage } from "./features/history/sessionDetailView";
import { startView } from "./features/session/startView";
import { button } from "../components/ui/button";
import { nativeSelect } from "../components/ui/native-select";
import "../index.css";

const now = 1_700_000_000_000;
const template = {
  id: "template-1",
  name: "Observation",
  isDefault: false,
  createdAt: now,
  updatedAt: now,
  fieldCount: 1,
  requiredCount: 1,
};
const field = {
  id: "field-1",
  name: "Outcome",
  kind: "radio" as const,
  isRequired: true,
  defaultValue: "",
  sortOrder: 0,
  options: ["Complete"],
  exclusiveOptions: [],
};
const editor = (count: 1 | 2, optionCount: 1 | 2, showModal = false) => {
  const fields = count === 1 ? [field] : [field, { ...field, id: "field-2", name: "Notes" }];
  return {
    id: "template-1",
    name: "Observation",
    isDefault: false,
    fields,
    original: { name: "Observation", isDefault: false, fields },
    isSaving: false,
    showAddField: showModal,
    editingFieldId: null,
    draft: showModal
      ? {
          ...field,
          id: "draft",
          name: "Outcome",
          options: optionCount === 1 ? ["Complete"] : ["Complete", "Incomplete"],
          newOptionText: "",
        }
      : null,
    pendingDiscard: false,
  };
};
const sections = ["Outcome", "Location", "Observer", "Notes"].map((sectionName, index) => ({
  sectionName,
  value: `Value ${index + 1}`,
  sectionType: "textInput",
  isRequired: index === 0,
  startedAt: now + index,
}));
const history = {
  id: "session-1",
  displayName: "Morning observation",
  templateName: "Observation",
  sessionName: "Morning observation",
  startedAt: now,
  endedAt: now + 60_000,
  taskCount: 1,
};
const detail = {
  id: history.id,
  sessionName: history.sessionName,
  templateName: history.templateName,
  startedAt: history.startedAt,
  endedAt: history.endedAt,
  taskCount: 1,
  tasks: [{ id: "task-1", taskId: 1, startedAt: now, endedAt: now + 30_000, sections }],
};

let handle: Runtime.EmbedHandle | undefined;
let container: HTMLDivElement | undefined;

const mount = async (
  view: (
    model: Model,
    h: Parameters<typeof templateEditorPage>[1],
  ) => ReturnType<typeof templateEditorPage>,
  height = 900,
) => {
  await page.viewport(700, height);
  container = document.createElement("div");
  container.id = `presentation-test-${crypto.randomUUID()}`;
  container.style.minHeight = `${height}px`;
  document.body.append(container);
  const model = init(Option.getOrThrow(fromString("https://example.com/#/start"))).model;
  handle = Runtime.embed(
    Runtime.makeElement({ Model, container, init: () => ({ model }), view, update }),
  );
};

afterEach(() => {
  handle?.dispose();
  container?.remove();
  vi.restoreAllMocks();
});

describe("persistent presentation regressions", () => {
  it.each([390, 1280])(
    "aligns controls and keeps the editor footer flush at %ipx",
    async (width) => {
      await mount((model, h) =>
        h.div(
          [h.Class("app-shell h-dvh overflow-y-auto")],
          [templateEditorPage({ ...model, editor: editor(2, 2) }, h)],
        ),
      );
      await page.viewport(width, 900);
      await expect.element(page.getByLabelText("Template Name")).toBeVisible();
      const root = document.querySelector(".template-editor")!;
      const footer = root.children[1]!;
      expect(getComputedStyle(root).paddingBottom).toBe("0px");
      expect(root.getBoundingClientRect().bottom).toBe(footer.getBoundingClientRect().bottom);
      expect(root.scrollWidth).toBe(root.clientWidth);
      for (const control of root.querySelectorAll(".btn, .input")) {
        expect(control.getBoundingClientRect().height).toBe(44);
      }
    },
  );

  it("aligns legacy inputs with shared buttons and selects", async () => {
    await mount((_model, h) =>
      h.div(
        [h.Class("app-shell flex gap-2")],
        [
          h.input([h.Class("input input-sm"), h.AriaLabel("Example")]),
          button({ size: "sm" }, "Action", h),
          button({ size: "icon-xs", attributes: [h.AriaLabel("Icon action")] }, "+", h),
          nativeSelect({ id: "example-select", label: "Choice", size: "sm", options: [] }, h),
        ],
      ),
    );
    await expect.element(page.getByLabelText("Example")).toBeVisible();
    for (const control of container!.querySelectorAll("input, button, select")) {
      expect(control.getBoundingClientRect().height).toBe(44);
    }
    expect(page.getByLabelText("Icon action").element().getBoundingClientRect().width).toBe(44);
  });

  it("renders a converted text input default exactly as it is stored", async () => {
    const convertedDraft = withKindChanged(
      {
        ...makeEmptyDraft(0),
        name: "Notes",
        kind: "textArea",
        defaultValue: "first\r\nsecond\nthird\rfourth",
      },
      "textInput",
    );
    const convertedEditor = {
      ...editor(1, 1, true),
      draft: convertedDraft,
    };

    await mount((model, h) => templateEditorPage({ ...model, editor: convertedEditor }, h));

    const defaultInput = page.getByLabelText("Default Value");
    await expect.element(defaultInput).toBeVisible();
    expect((defaultInput.element() as HTMLInputElement).value).toBe(convertedDraft.defaultValue);
    expect(convertedDraft.defaultValue).toBe("firstsecondthirdfourth");
    expect((defaultInput.element() as HTMLInputElement).value).not.toMatch(/[\r\n]/);
  });

  it.each([
    [1, 1, "1 field", "1 option"],
    [2, 2, "2 fields", "2 options"],
  ] as const)(
    "uses grammatical editor counts for %i field(s)",
    async (count, options, fieldLabel, optionLabel) => {
      await mount((model, h) =>
        templateEditorPage({ ...model, editor: editor(count, options, true) }, h),
      );
      await expect.element(page.getByText(fieldLabel, { exact: true })).toBeVisible();
      await expect.element(page.getByText(optionLabel, { exact: true })).toBeVisible();
    },
  );

  it("renders all singular history and resume counts, including the sliced field preview", async () => {
    await mount(
      (model, h) =>
        h.div(
          [h.Class("grid gap-8 bg-base-200 p-4")],
          [
            historyPage({ ...model, history: [history] }, h),
            sessionDetailPage({ ...model, selectedHistorySession: detail }, h),
            startView(
              {
                ...model,
                templates: [template],
                activeSession: {
                  id: history.id,
                  templateId: template.id,
                  templateName: template.name,
                  sessionName: history.sessionName,
                  startedAt: now,
                  completedCount: 1,
                },
              },
              h,
            ),
          ],
        ),
      1800,
    );
    await expect.element(page.getByText("+1 more field", { exact: true })).toBeVisible();
    const singularTaskLabels = [...document.querySelectorAll("span")].filter(
      (node) => node.textContent?.trim() === "1 task",
    );
    expect(singularTaskLabels).toHaveLength(3);
    expect(document.body.textContent).not.toContain("1 tasks");
    expect(document.body.textContent).not.toContain("1 more fields");
  });

  it("exposes native template, history, and task dropdown buttons to keyboard users", async () => {
    await mount(
      (model, h) =>
        h.div(
          [h.Class("grid gap-8 p-4")],
          [
            templatesPage({ ...model, templates: [template] }, h),
            historyPage({ ...model, history: [history] }, h),
            sessionDetailPage({ ...model, selectedHistorySession: detail }, h),
          ],
        ),
      1500,
    );
    for (const [buttonName, actionName] of [
      ['Actions for "Observation"', "Set as Default"],
      ['Actions for "Morning observation"', "Export CSV for Morning observation"],
      ["Actions for Task 1", "View details for Task 1"],
    ] as const) {
      const button = page.getByRole("button", { name: buttonName });
      const action =
        actionName === "View details for Task 1"
          ? page.getByText("View Details", { exact: true })
          : page.getByRole("button", { name: actionName });
      await expect.element(button).toBeVisible();
      (button.element() as HTMLButtonElement).focus();
      await expect.element(button).toHaveFocus();
      await userEvent.tab();
      expect(document.activeElement?.tagName).toBe("UL");
      await expect.element(action).toBeVisible();
      await userEvent.tab();
      await expect.element(action).toHaveFocus();
    }
  });
});
