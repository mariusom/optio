import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Effect, Option } from "effect";
import { Runtime } from "foldkit";
import { fromString } from "foldkit/url";
import type {} from "@vitest/browser-playwright";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

import { init, Model, update, view as appView } from "../main";
import { makeEmptyDraft, withKindChanged } from "./features/templates/editor";
import { templateEditorPage } from "./features/templates/editorView";
import { templatesPage } from "./features/templates/view";
import { historyPage } from "./features/history/historyView";
import { sessionDetailPage } from "./features/history/sessionDetailView";
import { startView } from "./features/session/startView";
import { settingsPage } from "./features/settings/view";
import { foldcnStyles, setCurrentStyle } from "./style";
import {
  changeAccent,
  changeFont,
  initializeAccent,
  initializeFont,
  initializeStyle,
  initializeTheme,
} from "./browserTheme";
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
  localStorage.removeItem("optio-font");
  localStorage.removeItem("optio-accent");
  document.documentElement.removeAttribute("data-font");
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("persistent presentation regressions", () => {
  it("loads defaults and reports unsaved choices when browser storage is blocked", async () => {
    const blocked = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    try {
      expect(
        await Effect.runPromise(
          Effect.all({
            theme: initializeTheme,
            style: initializeStyle,
            font: initializeFont,
            accent: initializeAccent,
          }),
        ),
      ).toEqual({ theme: "auto", style: "default", font: "sans", accent: "default" });
      expect(await Effect.runPromise(changeFont("mono"))).toBe(false);
      expect(await Effect.runPromise(changeAccent("rose"))).toBe(false);
      expect(document.documentElement.dataset.font).toBe("mono");
      expect(document.documentElement.dataset.accent).toBe("rose");
    } finally {
      blocked.mockRestore();
    }
  });

  it("applies and restores font and accent choices independently", async () => {
    await mount((model, h) =>
      settingsPage(
        model.theme,
        model.style,
        model.font,
        model.accent,
        model.themeSaveFailed,
        model.styleSaveFailed,
        model.fontSaveFailed,
        model.accentSaveFailed,
        h,
      ),
    );
    const fonts = page.getByRole("radiogroup", { name: "Font", exact: true });
    await expect.element(fonts).toBeVisible();
    const original = getComputedStyle(fonts.element()).fontFamily;
    await fonts.getByRole("radio", { name: "System serif" }).click();
    await expect.poll(() => localStorage.getItem("optio-font")).toBe("serif");
    expect(getComputedStyle(fonts.element()).fontFamily).not.toBe(original);
    expect(await Effect.runPromise(initializeFont)).toBe("serif");
    const colours = page.getByRole("radiogroup", { name: "Accent colour" });
    await colours.getByRole("radio", { name: "Violet" }).click();
    await expect.poll(() => localStorage.getItem("optio-accent")).toBe("violet");
    const lightPrimary = getComputedStyle(document.documentElement).getPropertyValue("--primary");
    await page.getByRole("radio", { name: "Dark", exact: true }).click();
    await expect.poll(() => document.documentElement.classList.contains("dark")).toBe(true);
    expect(getComputedStyle(document.documentElement).getPropertyValue("--primary")).not.toBe(
      lightPrimary,
    );
    expect(await Effect.runPromise(initializeAccent)).toBe("violet");
    expect(await Effect.runPromise(initializeFont)).toBe("serif");
  });

  it.each([390, 1280])("creates and edits questions inline at %ipx", async (width) => {
    await mount((model, h) => appView({ ...model, route: { _tag: "TemplatesTab" } }, h).body);
    await page.viewport(width, 900);
    await page.getByRole("button", { name: "Create template", exact: true }).click();
    await expect
      .element(page.getByRole("heading", { name: "New template", exact: true }))
      .toBeVisible();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Morning study");
    await page.getByRole("button", { name: "Add question", exact: true }).click();
    const form = page.getByRole("region", { name: "New question" });
    await expect.element(form).toBeVisible();
    expect(document.querySelector('[data-slot="sheet"]')).toBeNull();
    await page.getByRole("textbox", { name: "Question", exact: true }).fill("Activity");
    const done = page.getByRole("button", { name: "Save question" });
    await expect.element(done).toBeEnabled();
    await expect.element(page.getByRole("button", { name: "Save template" })).toBeDisabled();
    await done.click();
    const edit = page.getByRole("button", { name: "Edit question Activity" });
    await expect.element(edit).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Save template" })).toBeEnabled();
    await edit.click();
    await expect
      .element(page.getByRole("region", { name: "Edit question", exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("textbox", { name: "Question", exact: true }))
      .toHaveValue("Activity");
    const root = document.querySelector(".template-editor")!;
    expect(root.scrollWidth).toBe(root.clientWidth);
  });

  it("pins the mobile title and add action together while scrolling", async () => {
    await mount(
      (model, h) =>
        appView(
          {
            ...model,
            route: { _tag: "TemplatesTab" },
            templates: Array.from({ length: 30 }, (_, index) => ({
              ...template,
              id: `template-${index}`,
            })),
          },
          h,
        ).body,
    );
    await page.viewport(390, 700);
    const heading = page.getByRole("heading", { name: "Templates", exact: true });
    await expect.element(heading).toBeVisible();
    const action = page.getByRole("button", { name: "New template", exact: true });
    const initialTop = heading.element().getBoundingClientRect().top;
    heading.element().closest("main")!.scrollTop = 350;
    await new Promise(requestAnimationFrame);
    expect(heading.element().getBoundingClientRect().top).toBe(initialTop);
    const titleBounds = heading.element().getBoundingClientRect();
    const actionBounds = action.element().getBoundingClientRect();
    expect(
      Math.abs((titleBounds.top + titleBounds.bottom - actionBounds.top - actionBounds.bottom) / 2),
    ).toBeLessThan(1);
  });

  it("places a sheet above bottom navigation", async () => {
    await mount(
      (model, h) =>
        appView(
          {
            ...model,
            route: { _tag: "TemplatesTab" },
            templates: [template],
            templateActionsFor: template.id,
          },
          h,
        ).body,
    );
    await page.viewport(390, 700);
    await expect.element(page.getByRole("dialog")).toBeVisible();
    const hit = document.elementFromPoint(195, 680);
    expect(hit?.closest('[data-slot="sheet"]')).not.toBeNull();
  });

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
          settingsPage(
            model.theme,
            model.style,
            model.font,
            model.accent,
            model.themeSaveFailed,
            model.styleSaveFailed,
            model.fontSaveFailed,
            model.accentSaveFailed,
            h,
          ),
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
    expect(await Effect.runPromise(initializeStyle)).toBe("rhea");
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
