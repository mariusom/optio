import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Effect, Option } from "effect";
import { Runtime } from "foldkit";
import { fromString } from "foldkit/url";
import type {} from "@vitest/browser-playwright";

vi.mock("../livestore/client", () => ({ getStore: vi.fn() }));

import { init, Model, update, view as appView } from "../main";
import { Message } from "../messages";
import { makeEmptyDraft, withKindChanged } from "./features/templates/editor";
import { templateEditorPage } from "./features/templates/editorView";
import { templatesPage } from "./features/templates/view";
import { historyPage } from "./features/history/historyView";
import { sessionDetailPage } from "./features/history/sessionDetailView";
import { startView } from "./features/session/startView";
import { settingsPage } from "./features/settings/view";
import { foldcnStyles, setCurrentStyle } from "./style";
import { setCurrentIconLibrary } from "../lib/iconPreference";
import {
  changeAccent,
  changeFont,
  changeTheme,
  initializeAccent,
  initializeFont,
  initializeIconLibrary,
  initializeStyle,
  initializeTheme,
} from "./browserTheme";
import { confirmSheet, groupedList, navBar, navBarAction, row } from "../components/app";
import { button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Item } from "../components/ui/item";
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

afterEach(async () => {
  handle?.dispose();
  container?.remove();
  document.documentElement.style.removeProperty("font-size");
  await setCurrentStyle("nova");
  setCurrentIconLibrary("lucide");
  localStorage.removeItem("optio-icon-library");
  document.documentElement.removeAttribute("data-icon-library");
  localStorage.removeItem("optio-foldcn-style");
  localStorage.removeItem("optio-font");
  localStorage.removeItem("optio-accent");
  document.documentElement.removeAttribute("data-font");
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.style.removeProperty("--primary");
  document.documentElement.style.removeProperty("--primary-foreground");
  document.documentElement.style.removeProperty("--ring");
  document.documentElement.classList.remove("dark");
  vi.restoreAllMocks();
});

describe("persistent presentation regressions", () => {
  it.each([600, 1224])(
    "keeps the task answer card ring inside the sheet scrollport at %ipx",
    async (height) => {
      await mount(
        (model, h) =>
          sessionDetailPage(
            {
              ...model,
              selectedHistorySession: {
                ...detail,
                tasks: [
                  {
                    ...detail.tasks[0]!,
                    sections: Array.from({ length: 6 }, (_, index) => ({
                      ...sections[0]!,
                      sectionName: index === 5 ? "Notes" : `Question ${index + 1}`,
                      value: "dsfdsfds",
                    })),
                  },
                ],
              },
              selectedHistoryTaskId: "task-1",
            },
            h,
          ),
        height,
      );
      await page.viewport(1184, height);
      await expect.element(page.getByRole("dialog", { name: "Task 1", exact: true })).toBeVisible();
      await Promise.all(document.getAnimations().map((animation) => animation.finished));
      const card = document.querySelector('[data-slot="sheet"] [data-slot="grouped-list"]')!;
      const scrollport = card.parentElement!.parentElement!;
      scrollport.scrollTop = scrollport.scrollHeight;
      await new Promise(requestAnimationFrame);
      expect(
        scrollport.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom,
      ).toBeGreaterThanOrEqual(1);
    },
  );

  it.each(foldcnStyles)("keeps history separators stable in %s", async (style) => {
    await setCurrentStyle(style);
    await mount((model, h) =>
      sessionDetailPage(
        {
          ...model,
          selectedHistorySession: {
            ...detail,
            tasks: [...detail.tasks, { ...detail.tasks[0]!, id: "task-2", taskId: 2 }],
          },
        },
        h,
      ),
    );
    await expect
      .element(page.getByRole("button", { name: "View details for Task 2" }))
      .toBeVisible();
    for (const group of document.querySelectorAll('[data-slot="grouped-list"]')) {
      const rows = [...group.children];
      for (const row of rows.slice(0, -1)) {
        expect(getComputedStyle(row).borderBottomWidth).toBe("1px");
      }
      expect(getComputedStyle(rows.at(-1)!).borderBottomWidth).toBe("0px");
    }
    const task = page
      .getByRole("button", { name: "View details for Task 1" })
      .element() as HTMLButtonElement;
    const borderColor = getComputedStyle(task).borderBottomColor;
    task.focus();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(getComputedStyle(task).borderBottomColor).toBe(borderColor);
    expect(getComputedStyle(task).outlineWidth).toBe("2px");
    expect(getComputedStyle(task).outlineStyle).toBe("solid");
    expect(getComputedStyle(task).outlineOffset).toBe("-3px");
  });

  it.each(foldcnStyles)("fills the history action cell in %s", async (style) => {
    await setCurrentStyle(style);
    await mount((model, h) => historyPage({ ...model, history: [history] }, h));
    await page.viewport(1184, 900);
    const action = page.getByRole("button", { name: `Actions for "${history.displayName}"` });
    await expect.element(action).toBeVisible();
    const button = action.element();
    const bounds = button.getBoundingClientRect();
    const parent = button.parentElement!.getBoundingClientRect();
    expect(bounds.top).toBe(parent.top);
    expect(bounds.bottom).toBe(parent.bottom);
    expect(bounds.right).toBe(parent.right);
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(getComputedStyle(button).borderRadius).toBe("0px");
  });

  it.each(foldcnStyles)("uses %s Card and Item styling in template groups", async (style) => {
    await setCurrentStyle(style);
    await mount((model, h) =>
      h.div(
        [],
        [
          Card({}, [Item({}, ["Reference row"], h)], h),
          templateEditorPage({ ...model, editor: editor(1, 1) }, h),
        ],
      ),
    );
    await expect.element(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
    const css = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    expect(css('[data-slot="grouped-list"]').borderRadius).toBe(
      css('[data-slot="card"]').borderRadius,
    );
    expect(css('[data-slot="grouped-list"]').boxShadow).toBe(css('[data-slot="card"]').boxShadow);
    expect(css('[data-slot="grouped-list"]').borderWidth).toBe(
      css('[data-slot="card"]').borderWidth,
    );
    const itemPadding = css('[data-slot="item"]').padding;
    expect(getComputedStyle(document.querySelector("#template-name")!.parentElement!).padding).toBe(
      itemPadding,
    );
    expect(css('[aria-label="Edit question Outcome"]').padding).toBe(itemPadding);
  });

  it.each(foldcnStyles)(
    "keeps unboxed question fields free of %s card decoration",
    async (style) => {
      await setCurrentStyle(style);
      const state = editor(1, 1, true);
      await mount((model, h) =>
        templateEditorPage(
          { ...model, editor: { ...state, draft: { ...state.draft!, kind: "textInput" } } },
          h,
        ),
      );
      await expect
        .element(page.getByRole("textbox", { name: "Question", exact: true }))
        .toBeVisible();
      const groups = document.querySelectorAll('#question-editor [data-slot="grouped-list"]');
      expect(groups).toHaveLength(3);
      for (const group of groups) {
        expect(getComputedStyle(group).borderWidth).toBe("0px");
        expect(getComputedStyle(group).boxShadow).toBe("none");
      }
    },
  );

  it("switches navigation icons immediately and restores the saved library", async () => {
    expect(await Effect.runPromise(initializeIconLibrary)).toBe("hugeicons");
    await mount((model, h) => appView({ ...model, route: { _tag: "SettingsTab" } }, h).body);
    await expect.element(page.getByRole("link", { name: "Templates", exact: true })).toBeVisible();
    const navigationIcon = () =>
      page.getByRole("link", { name: "Templates", exact: true }).element().querySelector("svg")!
        .innerHTML;
    const original = navigationIcon();
    const picker = page.getByRole("radiogroup", { name: "Icon style" });
    expect(
      [...picker.element().querySelectorAll('[role="radio"]')].map((e) => e.textContent),
    ).toEqual(["Hugeicons", "Lucide"]);
    await picker.getByRole("radio", { name: "Lucide", exact: true }).click();
    await expect.poll(navigationIcon).not.toBe(original);
    await expect.poll(() => localStorage.getItem("optio-icon-library")).toBe("lucide");
    const lucide = navigationIcon();
    setCurrentIconLibrary("hugeicons");
    expect(await Effect.runPromise(initializeIconLibrary)).toBe("lucide");
    await picker.getByRole("radio", { name: "Hugeicons", exact: true }).click();
    await expect.poll(navigationIcon).toBe(original);
    expect(lucide).not.toBe(original);
  });

  it.each([390, 1184])("stacks template actions with icons at %ipx", async (width) => {
    await mount((model, h) =>
      templatesPage({ ...model, templates: [template], templateActionsFor: template.id }, h),
    );
    await page.viewport(width, 1224);
    const dialog = page.getByRole("dialog", { name: template.name });
    await expect.element(dialog).toBeVisible();
    const actions = ["Set as default", "Duplicate", "Delete"].map((name) =>
      dialog.getByRole("button", { name, exact: true }).element(),
    );
    for (const action of actions) expect(action.querySelector("svg")).not.toBeNull();
    const boxes = actions.map((action) => action.getBoundingClientRect());
    expect(boxes[0]!.bottom).toBeLessThanOrEqual(boxes[1]!.top);
    expect(boxes[1]!.bottom).toBeLessThanOrEqual(boxes[2]!.top);
    expect(new Set(boxes.map((box) => box.left)).size).toBe(1);
    expect(new Set(boxes.map((box) => box.width)).size).toBe(1);
    expect(actions[2]!.closest('[data-slot="action-group"]')).toBeNull();
  });

  it("matches the favicon mark to the sidebar and updates saved/custom/theme colours", async () => {
    const favicon = () =>
      new DOMParser().parseFromString(
        decodeURIComponent(
          document.querySelector<HTMLLinkElement>('link[rel="icon"]')!.href.split(",")[1]!,
        ),
        "image/svg+xml",
      );
    await Effect.runPromise(changeAccent("#123456"));
    expect(favicon().querySelector("text")!.textContent).toBe("o");
    expect(favicon().querySelector("rect")!.getAttribute("fill")).toBe("#123456");
    expect(favicon().querySelector("text")!.getAttribute("fill")).toBe("#ffffff");
    await Effect.runPromise(changeAccent("#eeeeee"));
    expect(favicon().querySelector("text")!.getAttribute("fill")).toBe("#000000");
    await Effect.runPromise(initializeAccent);
    expect(favicon().querySelector("rect")!.getAttribute("fill")).toBe("#eeeeee");
    await Effect.runPromise(changeAccent("blue"));
    await Effect.runPromise(changeTheme("light"));
    const light = favicon().querySelector("rect")!.getAttribute("fill");
    await Effect.runPromise(changeTheme("dark"));
    expect(favicon().querySelector("rect")!.getAttribute("fill")).not.toBe(light);
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    await Effect.runPromise(changeTheme("auto"));
  });

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
      ).toEqual({ theme: "auto", style: "nova", font: "sans", accent: "default" });
      expect(await Effect.runPromise(changeFont("mono"))).toBe(false);
      expect(await Effect.runPromise(changeAccent("rose"))).toBe(false);
      expect(document.documentElement.dataset.font).toBe("mono");
      expect(document.documentElement.dataset.accent).toBe("rose");
    } finally {
      blocked.mockRestore();
    }
  });

  it("confirms custom colours, cancels drafts, restores preferences and returns to presets", async () => {
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
        model.accentDraft,
      ),
    );
    const choices = page.getByRole("radiogroup", { name: "Accent colour" });
    const other = choices.getByRole("radio", { name: /Other/ });
    await choices.getByRole("radio", { name: "Blue", exact: true }).click();
    await expect.poll(() => localStorage.getItem("optio-accent")).toBe("blue");
    await other.click();
    const dialog = page.getByRole("dialog", { name: "Custom accent colour" });
    const hex = dialog.getByRole("textbox", { name: "Hex colour" });
    await hex.fill("#fff");
    await expect.element(dialog.getByRole("button", { name: "Use colour" })).toBeDisabled();
    await hex.fill("#F4C542");
    expect(localStorage.getItem("optio-accent")).toBe("blue");
    expect(document.documentElement.dataset.accent).toBe("blue");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    await other.click();
    await hex.fill("#F4C542");
    await dialog.getByRole("button", { name: "Use colour" }).click();
    await expect.poll(() => localStorage.getItem("optio-accent")).toBe("#f4c542");
    await expect.element(other).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.style.getPropertyValue("--primary-foreground")).toBe("#000000");
    await other.click();
    await expect.element(hex).toHaveValue("#f4c542");
    await hex.fill("#123456");
    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    expect(await Effect.runPromise(initializeAccent)).toBe("#f4c542");
    await choices.getByRole("radio", { name: "Rose", exact: true }).click();
    await expect.poll(() => localStorage.getItem("optio-accent")).toBe("rose");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--ring")).toBe("");
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

  it.each(
    [390, 1184].flatMap((width) =>
      (["textInput", "textArea", "radio", "checkbox", "boolean"] as const).map((kind) => ({
        width,
        kind,
      })),
    ),
  )("aligns $kind editor fields at $width px", async ({ width, kind }) => {
    const state = editor(1, 2, true);
    await mount((_model, h) =>
      templateEditorPage(
        { editor: { ...state, draft: { ...state.draft!, kind } }, lastError: null },
        h,
      ),
    );
    await page.viewport(width, 1224);
    const form = document.querySelector<HTMLElement>("#question-editor")!;
    const bounds = form.getBoundingClientRect();
    const left = bounds.left;
    const right = bounds.right;
    // Unboxed fields, headings, helper text and action footer share the form inset.
    for (const element of form.querySelectorAll(
      "#question-name, #answer-type, #question-default, h2, label, :scope > div:last-child",
    )) {
      if (element.closest('[data-slot="grouped-list"]')?.querySelector("#new-choice")) continue;
      const rect = element.getBoundingClientRect();
      expect(Math.abs(rect.left - left), element.outerHTML).toBeLessThanOrEqual(1);
      expect(rect.right).toBeLessThanOrEqual(right + 1);
    }
    for (const element of form.querySelectorAll(
      "#question-name, #answer-type, #question-default",
    )) {
      expect(Math.abs(element.getBoundingClientRect().right - right)).toBeLessThanOrEqual(1);
    }
    const newChoice = form.querySelector("#new-choice");
    if (newChoice) {
      const list = newChoice.closest('[data-slot="grouped-list"]')!;
      expect(Math.abs(list.getBoundingClientRect().left - left)).toBeLessThanOrEqual(1);
      expect(Math.abs(list.getBoundingClientRect().right - right)).toBeLessThanOrEqual(1);
      // Nova's Card ring doesn't affect the 12px Item inset.
      expect(newChoice.getBoundingClientRect().left - list.getBoundingClientRect().left).toBe(12);
      expect(list.firstElementChild!.firstElementChild!.getBoundingClientRect().left).toBe(
        newChoice.getBoundingClientRect().left,
      );
    }
    expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
  });

  it.each([390, 1280])("creates and edits questions in a focused page at %ipx", async (width) => {
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
    expect(document.querySelector('[aria-label="Save template"]')).toBeNull();
    expect(document.querySelector("#template-name")).toBeNull();
    await expect.element(page.getByText("Morning study", { exact: true })).toBeVisible();
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
    const group = root.querySelector('#question-editor [data-slot="action-group"]')!;
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Delete question",
      "Cancel",
      "Done editing",
    ]);
    const [remove, cancel, confirm] = buttons.map((button) => button.getBoundingClientRect());
    expect(cancel!.right).toBeLessThan(confirm!.left);
    expect(cancel!.top).toBe(confirm!.top);
    expect(remove!.left).toBe(group.getBoundingClientRect().left);
    expect(confirm!.right).toBe(group.getBoundingClientRect().right);
    if (width === 1280) expect(remove!.top).toBe(confirm!.top);
    expect(document.querySelector('[aria-label="Edit question Activity"]')).toBeNull();
    await page.getByRole("textbox", { name: "Question", exact: true }).fill("Canceled change");
    await page.getByRole("button", { name: "Cancel editing question" }).click();
    await expect.element(edit).toBeVisible();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await edit.click();
    await expect
      .element(page.getByRole("textbox", { name: "Question", exact: true }))
      .toHaveValue("Activity");
    await page.getByRole("textbox", { name: "Question", exact: true }).fill("Changed activity");
    await page.getByRole("button", { name: "Back to Template builder", exact: true }).click();
    await expect.element(page.getByRole("dialog", { name: "Discard your changes?" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Discard your changes?" })
      .getByText("Keep editing", { exact: true })
      .click();
    await expect
      .element(page.getByRole("textbox", { name: "Question", exact: true }))
      .toHaveValue("Changed activity");
    await page.getByRole("button", { name: "Back to Template builder", exact: true }).click();
    await page.getByRole("button", { name: "Confirm discard changes" }).click();
    await expect.element(edit).toBeVisible();
    await expect
      .element(page.getByRole("textbox", { name: "Name", exact: true }))
      .toHaveValue("Morning study");
  });

  it.each([320, 1184])(
    "keeps confirmation order and destructive separation at %ipx",
    async (width) => {
      for (const destructive of [false, true]) {
        await mount((_model, h) =>
          confirmSheet(
            {
              id: "action-order",
              title: "Confirm action",
              message: "Check the action order.",
              confirmLabel: destructive ? "Delete" : "Save",
              destructive,
              onConfirm: Message.CanceledAddField(),
              onCancel: Message.CanceledAddField(),
            },
            h,
          ),
        );
        await page.viewport(width, 900);
        const dialog = page.getByRole("dialog", { name: "Confirm action" });
        await expect.element(dialog).toBeVisible();
        const group = dialog.element().querySelector('[data-slot="action-group"]')!;
        const buttons = [...group.querySelectorAll("button")];
        expect(buttons.map((button) => button.textContent)).toEqual(
          destructive ? ["Delete", "Cancel"] : ["Cancel", "Save"],
        );
        const [left, right] = buttons.map((button) => button.getBoundingClientRect());
        expect(left!.right).toBeLessThan(right!.left);
        expect(left!.top).toBe(right!.top);
        expect(group.scrollWidth).toBe(group.clientWidth);
        handle?.dispose();
        container?.remove();
      }
    },
  );

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
    await setCurrentStyle(style);
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
    await setCurrentStyle(style);
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
    expect(choices.element().querySelectorAll('[role="radio"]')).toHaveLength(8);
    await expect
      .element(choices.getByRole("radio", { name: "Nova", exact: true }))
      .toHaveAttribute("aria-checked", "true");
    const renderedClasses = new Set<string>();
    const choiceClasses = new Set<string>();
    for (const style of foldcnStyles) {
      const label = style[0]!.toUpperCase() + style.slice(1);
      const option = choices.getByRole("radio", { name: label, exact: true });
      await option.click();
      await expect.element(option).toHaveAttribute("aria-checked", "true");
      await expect.poll(() => localStorage.getItem("optio-foldcn-style")).toBe(style);
      const sample = page.getByRole("button", { name: "Style sample" }).element();
      renderedClasses.add(sample.className);
      expect(sample.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      const row = choices.getByRole("radio", { name: "Nova", exact: true }).element();
      choiceClasses.add(row.className);
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    // Styles must change actual rendered components, not only the radio value.
    expect(renderedClasses.size).toBeGreaterThan(4);
    expect(choiceClasses.size).toBeGreaterThan(4);
    await setCurrentStyle("nova");
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
        h.div(
          [],
          [
            templateEditorPage({ ...model, editor: editor(count, options) }, h),
            templateEditorPage({ ...model, editor: editor(count, options, true) }, h),
          ],
        ),
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
