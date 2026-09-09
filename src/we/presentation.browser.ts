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
import { settingsPage } from "./features/settings/view";
import { foldcnStyles, setCurrentStyle } from "./style";
import { initializeStyle } from "./browserTheme";
import { groupedList, navBar, navBarAction, row } from "../components/app";
import { button } from "../components/ui/button";
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
  document.documentElement.style.removeProperty("font-size");
  setCurrentStyle("default");
  localStorage.removeItem("optio-foldcn-style");
  vi.restoreAllMocks();
});

describe("persistent presentation regressions", () => {
  it.each(foldcnStyles)("fills template action cells in %s", async (style) => {
    setCurrentStyle(style);
    await mount((model, h) => templatesPage({ ...model, templates: [template] }, h));
    const action = page.getByRole("button", { name: 'Actions for "Observation"' });
    await expect.element(action).toBeVisible();
    const element = action.element();
    const bounds = element.getBoundingClientRect();
    const rowBounds = element.parentElement!.getBoundingClientRect();
    expect(bounds.top).toBe(rowBounds.top);
    expect(bounds.bottom).toBe(rowBounds.bottom);
    expect(bounds.right).toBe(rowBounds.right);
    expect(getComputedStyle(element).borderRadius).toBe("0px");
  });

  it.each(foldcnStyles)("fills question move action cells in %s", async (style) => {
    setCurrentStyle(style);
    await mount((model, h) => templateEditorPage({ ...model, editor: editor(2, 2) }, h));
    const down = page.getByRole("button", { name: "Move Outcome down" });
    await expect.element(down).toBeVisible();
    for (const name of ["Move Outcome up", "Move Outcome down"]) {
      const element = page.getByRole("button", { name }).element();
      const bounds = element.getBoundingClientRect();
      const rowElement = element.closest(".lazy-row")!;
      const rowBounds = rowElement.getBoundingClientRect();
      expect(bounds.top).toBe(rowBounds.top);
      expect(bounds.bottom).toBe(
        rowBounds.bottom - parseFloat(getComputedStyle(rowElement).borderBottomWidth),
      );
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(getComputedStyle(element).borderRadius).toBe("0px");
    }
    expect(down.element().getBoundingClientRect().right).toBe(
      down.element().closest(".lazy-row")!.getBoundingClientRect().right,
    );
    if (style === "lyra") {
      const input = page.getByRole("textbox", { name: "Name", exact: true }).element();
      expect(getComputedStyle(input).borderRadius).toBe("0px");
      expect(input.getBoundingClientRect().height).toBe(44);
    }
  });

  it("applies every settings style and restores the last selection", async () => {
    await mount((model, h) =>
      h.div(
        [],
        [
          settingsPage(model.theme, model.style, model.themeSaveFailed, model.styleSaveFailed, h),
          button({}, "Style sample", h),
        ],
      ),
    );
    const choices = page.getByRole("radiogroup", { name: "Component style" });
    await expect.element(choices).toBeVisible();
    expect(choices.element().querySelectorAll('[role="radio"]')).toHaveLength(9);
    const renderedClasses = new Set<string>();
    for (const style of foldcnStyles) {
      const label =
        style === "default" ? "Default (Nova)" : style[0]!.toUpperCase() + style.slice(1);
      const option = choices.getByRole("radio", { name: label, exact: true });
      await option.click();
      await expect.element(option).toHaveAttribute("aria-checked", "true");
      await expect.poll(() => localStorage.getItem("optio-foldcn-style")).toBe(style);
      const sample = page.getByRole("button", { name: "Style sample" }).element();
      renderedClasses.add(sample.className);
      expect(sample.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    // Styles must change actual rendered components, not only the radio value.
    expect(renderedClasses.size).toBeGreaterThan(4);
    setCurrentStyle("default");
    expect(initializeStyle()).toBe("rhea");
  });

  it.each([16, 20])("scales base controls with a %ipx root font", async (rootSize) => {
    await mount((_model, h) =>
      h.div([], [button({}, "Default control", h), button({ size: "lg" }, "Large control", h)]),
    );
    document.documentElement.style.fontSize = `${rootSize}px`;
    await expect.element(page.getByRole("button", { name: "Large control" })).toBeVisible();
    for (const [name, height, padding] of [
      ["Default control", 44, 16],
      ["Large control", 48, 24],
    ] as const) {
      const style = getComputedStyle(page.getByRole("button", { name }).element());
      expect(parseFloat(style.height)).toBe((height * rootSize) / 16);
      expect(parseFloat(style.paddingLeft)).toBe((padding * rootSize) / 16);
      expect(parseFloat(style.paddingRight)).toBe((padding * rootSize) / 16);
      expect(parseFloat(style.borderRadius)).toBe((8 * rootSize) / 16);
    }
  });

  it.each([390, 820, 1440])(
    "uses base form geometry in the session page at %ipx",
    async (width) => {
      await mount((model, h) => startView({ ...model, templates: [template] }, h));
      await page.viewport(width, 900);
      await expect.element(page.getByLabelText("Session name", { exact: true })).toBeVisible();
      for (const name of ["Study template", "Session name"]) {
        const style = getComputedStyle(page.getByLabelText(name, { exact: true }).element());
        expect(parseFloat(style.height)).toBe(44);
        expect(parseFloat(style.paddingLeft)).toBe(12);
        expect(parseFloat(style.borderRadius)).toBe(8);
        expect(parseFloat(style.fontSize)).toBe(width < 768 ? 16 : 14);
      }
      const action = page.getByRole("button", { name: "Start Session", exact: true }).element();
      expect(parseFloat(getComputedStyle(action).height)).toBe(48);
      expect(parseFloat(getComputedStyle(action).paddingLeft)).toBe(24);
      const content = action.closest('[data-slot="page"]')!;
      expect(content.scrollWidth).toBe(content.clientWidth);
      expect(parseFloat(getComputedStyle(content).paddingLeft)).toBe(width < 768 ? 16 : 24);
    },
  );

  it.each([390, 1280])("keeps the editor within the viewport at %ipx", async (width) => {
    await mount((model, h) =>
      h.div(
        [h.Class("app-shell h-dvh overflow-y-auto")],
        [templateEditorPage({ ...model, editor: editor(2, 2) }, h)],
      ),
    );
    await page.viewport(width, 900);
    await expect.element(page.getByLabelText("Name", { exact: true })).toBeVisible();
    const root = document.querySelector(".template-editor")!;
    expect(root.scrollWidth).toBe(root.clientWidth);
    // The nav bar stays pinned to the top of the screen while the form scrolls.
    const navBarElement = root.querySelector('[data-slot="nav-bar"]')!;
    expect(getComputedStyle(navBarElement).position).toBe("sticky");
    // Every control the thumb has to hit is at least a 44px target.
    for (const control of root.querySelectorAll("button, input, textarea")) {
      if (control.closest('[data-slot="switch"]') !== null) continue;
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
  });

  it("keeps every app-layer control at least 44px tall", async () => {
    await mount((_model, h) =>
      h.div(
        [h.Class("app-shell flex flex-col gap-2")],
        [
          navBar(
            {
              title: "Example",
              back: { href: "#start", label: "Back" },
              trailing: [navBarAction({ label: "Done", ariaLabel: "Done action" }, h)],
            },
            h,
          ),
          groupedList({}, [row({ title: "Row action", href: "#start" }, h)], h),
          button({ size: "lg", className: "h-12" }, "Primary", h),
        ],
      ),
    );
    await expect.element(page.getByLabelText("Done action")).toBeVisible();
    for (const control of container!.querySelectorAll("a, button")) {
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
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

    const defaultInput = page.getByLabelText("Default answer");
    await expect.element(defaultInput).toBeVisible();
    expect((defaultInput.element() as HTMLInputElement).value).toBe(convertedDraft.defaultValue);
    expect(convertedDraft.defaultValue).toBe("firstsecondthirdfourth");
    expect((defaultInput.element() as HTMLInputElement).value).not.toMatch(/[\r\n]/);
  });

  it.each([
    [1, 1, "1 question", "1 choice"],
    [2, 2, "2 questions", "2 choices"],
  ] as const)(
    "uses grammatical editor counts for %i question(s)",
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
          [h.Class("grid gap-8 bg-background p-4")],
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
    // The task row previews the first two answers only.
    await expect
      .element(page.getByText("Outcome: Value 1 · Location: Value 2", { exact: true }))
      .toBeVisible();
    expect(document.body.textContent).toContain("1 task");
    expect(document.body.textContent).not.toContain("1 tasks");
    expect(document.body.textContent).not.toContain("Value 4");
  });

  it("opens the history action sheet from a named, keyboard-reachable button", async () => {
    await mount(
      (model, h) => h.div([h.Class("p-4")], [historyPage({ ...model, history: [history] }, h)]),
      900,
    );
    const trigger = page.getByRole("button", { name: 'Actions for "Morning observation"' });
    await expect.element(trigger).toBeVisible();
    (trigger.element() as HTMLButtonElement).focus();
    await expect.element(trigger).toHaveFocus();
    await userEvent.click(trigger);
    const exportAction = page.getByRole("button", { name: "Export Morning observation" });
    await expect.element(exportAction).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Delete Morning observation" }))
      .toBeVisible();
    (exportAction.element() as HTMLButtonElement).focus();
    await expect.element(exportAction).toHaveFocus();
  });

  it("opens the template action sheet from a named, keyboard-reachable button", async () => {
    await mount(
      (model, h) =>
        h.div([h.Class("grid gap-8 p-4")], [templatesPage({ ...model, templates: [template] }, h)]),
      1500,
    );
    const trigger = page.getByRole("button", { name: 'Actions for "Observation"' });
    await expect.element(trigger).toBeVisible();
    (trigger.element() as HTMLButtonElement).focus();
    await expect.element(trigger).toHaveFocus();
    await userEvent.click(trigger);
    const setDefault = page.getByRole("button", { name: "Set as default" });
    await expect.element(setDefault).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Duplicate" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Delete" })).toBeVisible();
    (setDefault.element() as HTMLButtonElement).focus();
    await expect.element(setDefault).toHaveFocus();
  });

  it("shows what each template asks for and offers the ready-made studies", async () => {
    await mount(
      (model, h) =>
        h.div(
          [h.Class("grid gap-8 p-4")],
          [
            templatesPage(
              {
                ...model,
                templates: [{ ...template, isDefault: true, fieldCount: 5, requiredCount: 3 }],
              },
              h,
            ),
          ],
        ),
      1200,
    );
    await expect.element(page.getByText("5 questions · 3 required", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Default", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Add sample templates" })).toBeVisible();
  });
});
