import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { Option } from "effect";
import { Runtime } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { fromString } from "foldkit/url";

import { init, Model, update } from "../../../main";
import type { Message } from "../../../messages";
import { templateEditorPage } from "./editorView";
import { templatesPage } from "./view";
import "../../../index.css";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

let handle: { dispose: () => void } | undefined;
let container: HTMLElement | undefined;

const mount = async (
  view: (model: Model, h: HtmlBuilder<Message>) => Html,
  options: Readonly<{ width: number; initial?: Partial<Model> }>,
) => {
  const { width } = options;
  await page.viewport(width, 900);
  container = document.createElement("div");
  container.id = `templates-layout-${crypto.randomUUID()}`;
  container.style.minHeight = "900px";
  document.body.append(container);
  const model = {
    ...init(Option.getOrThrow(fromString("https://example.com/#/templates"))).model,
    ...options.initial,
  };
  const target = container;
  handle = Runtime.embed(
    Runtime.makeElement({ Model, container, init: () => ({ model }), view, update, slow: false }),
  );
  await vi.waitFor(() => {
    if (target.isConnected && !target.hasChildNodes()) throw new Error("Not rendered yet");
  });
};

afterEach(() => {
  handle?.dispose();
  container?.remove();
});

const summary = (index: number) => ({
  id: `template-${index}`,
  name: `Template ${index}`,
  isDefault: index === 1,
  createdAt: 0,
  updatedAt: 0,
  fieldCount: 3,
  requiredCount: 1,
});

const field = {
  id: "field-1",
  name: "Tools used",
  kind: "checkbox" as const,
  isRequired: false,
  defaultValue: "",
  sortOrder: 0,
  options: ["Torque driver", "Hoist", "None"],
  exclusiveOptions: ["None"],
};

const choiceEditor = (options: ReadonlyArray<string>) => ({
  id: "template-1",
  name: "Assembly line",
  isDefault: false,
  fields: [field],
  original: { name: "Assembly line", isDefault: false, fields: [field] },
  isSaving: false,
  showAddField: true,
  editingFieldId: field.id,
  draft: { ...field, options: [...options], newOptionText: "" },
  pendingDiscard: false,
});

describe.each([390, 820, 1184])("compact choice rows at %ipx", (width) => {
  it("keeps each choice on one 44px line with labelled controls", async () => {
    const options = ["Torque driver", "Hoist", "None"];
    await mount((model, h) => templateEditorPage(model, h), {
      width,
      initial: { editor: choiceEditor(options) },
    });
    const form = document.querySelector<HTMLElement>("#question-editor")!;
    for (const option of options) {
      const toggle = page.getByRole("button", { name: `${option} clears others`, exact: true });
      await expect.element(toggle).toBeVisible();
      const row = toggle.element().parentElement!;
      expect(row.getBoundingClientRect().height).toBeLessThan(56);
      for (const name of [
        `${option} clears others`,
        `Move choice ${option} up`,
        `Move choice ${option} down`,
        `Remove choice ${option}`,
      ]) {
        const box = page.getByRole("button", { name, exact: true }).element();
        const bounds = box.getBoundingClientRect();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        // Same line: every control sits within the row's single band.
        expect(bounds.top).toBeGreaterThanOrEqual(row.getBoundingClientRect().top - 1);
        expect(bounds.bottom).toBeLessThanOrEqual(row.getBoundingClientRect().bottom + 1);
      }
    }
    await expect
      .element(page.getByRole("button", { name: "None clears others" }))
      .toHaveAttribute("aria-pressed", "true");
    const hoist = page.getByRole("button", { name: "Hoist clears others" });
    await expect.element(hoist).toHaveAttribute("aria-pressed", "false");
    await hoist.click();
    await expect.element(hoist).toHaveAttribute("aria-pressed", "true");
    await expect
      .element(page.getByRole("button", { name: "Move choice Torque driver up" }))
      .toBeDisabled();
    await expect
      .element(page.getByRole("button", { name: "Move choice None down" }))
      .toBeDisabled();
    expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
  });

  it("names question rows by their visible text", async () => {
    await mount((model, h) => templateEditorPage(model, h), {
      width,
      initial: { editor: { ...choiceEditor(["A", "B"]), draft: null, editingFieldId: null } },
    });
    const edit = page.getByRole("button", { name: "Tools used Multiple choice", exact: true });
    await expect.element(edit).toBeVisible();
    expect(edit.element().hasAttribute("aria-label")).toBe(false);
    await expect.element(page.getByRole("button", { name: "Move Tools used up" })).toBeDisabled();
  });

  it("wraps a long choice name without overflowing", async () => {
    const long = "Pneumatic impact wrench with extended socket set";
    await mount((model, h) => templateEditorPage(model, h), {
      width,
      initial: { editor: choiceEditor([long, "None"]) },
    });
    await expect.element(page.getByText(long)).toBeVisible();
    const form = document.querySelector<HTMLElement>("#question-editor")!;
    expect(form.scrollWidth).toBeLessThanOrEqual(form.clientWidth);
  });
});

/** Template names in the order the table shows them. */
const visibleOrder = () =>
  [...document.querySelectorAll("tbody tr")].map(
    (row) => row.querySelector("button")!.textContent!.match(/Template \d/)![0],
  );

/** Template rows are named by their visible text, starting with the title. */
const openRow = (index: number) =>
  page.getByRole("button", { name: new RegExp(`^Template ${index} `) }).element();

describe("template list layout", () => {
  const templates = [1, 2, 3].map(summary);
  const list = (model: Model, h: HtmlBuilder<Message>) =>
    templatesPage({ ...model, templates, templateActionsFor: null }, h);

  it("shows rows without a chevron, keeping the actions button and Default badge", async () => {
    await mount(list, { width: 390 });
    await expect.element(page.getByText("Default", { exact: true })).toBeVisible();
    expect(openRow(2).querySelector("svg")).toBeNull();
    await expect
      .element(page.getByRole("button", { name: 'Actions for "Template 2"' }))
      .toBeVisible();
  });

  it("names each row by its visible text so voice control can activate it", async () => {
    await mount(list, { width: 390 });
    const first = page.getByRole("button", {
      name: "Template 1 Default 3 questions · 1 required",
      exact: true,
    });
    await expect.element(first).toBeVisible();
    for (const index of [1, 2, 3]) {
      const row = openRow(index);
      expect(row.hasAttribute("aria-label")).toBe(false);
      expect(row.textContent).toContain(`Template ${index}`);
    }
  });

  it("sorts by name both ways and reports the order to assistive technology", async () => {
    await mount(list, { width: 1280 });
    expect(visibleOrder()).toEqual(["Template 1", "Template 2", "Template 3"]);
    const name = page.getByRole("columnheader", { name: "Name" });
    await expect.element(name).toHaveAttribute("aria-sort", "ascending");
    await name.getByRole("button").click();
    await expect.element(name).toHaveAttribute("aria-sort", "descending");
    expect(visibleOrder()).toEqual(["Template 3", "Template 2", "Template 1"]);
  });

  it("filters rows by search and counts the matches", async () => {
    await mount(list, { width: 1280 });
    await page.getByRole("searchbox", { name: "Search templates" }).fill("template 2");
    await expect.poll(visibleOrder).toEqual(["Template 2"]);
    await expect.element(page.getByText("1 of 3 templates")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search templates" }).fill("nothing like it");
    await expect.element(page.getByText("No templates match your search.")).toBeVisible();
  });

  it("hides the count columns on phones without scrolling sideways", async () => {
    await mount(list, { width: 390 });
    await expect.element(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    const headers = [...document.querySelectorAll("th")].filter((th) => th.offsetParent !== null);
    expect(headers.map((th) => th.textContent)).toEqual(["Name", "Actions"]);
    const table = document.querySelector<HTMLElement>("[data-slot=table-container]")!;
    expect(table.scrollWidth).toBeLessThanOrEqual(table.clientWidth);
  });
});

describe("adding choices with Enter", () => {
  it("adds every choice when typing fast, without merging or dropping any", async () => {
    await mount((model, h) => templateEditorPage(model, h), {
      width: 390,
      initial: { editor: choiceEditor([]) },
    });
    const input = page.getByRole("textbox", { name: "New choice", exact: true });
    await input.click();
    // No delay between keys: Enter follows each word's last input event at once.
    await userEvent.keyboard("Alpha{Enter}Beta{Enter}Gamma{Enter}Delta{Enter}");
    for (const option of ["Alpha", "Beta", "Gamma", "Delta"]) {
      await expect
        .element(page.getByRole("button", { name: `Remove choice ${option}`, exact: true }))
        .toBeVisible();
    }
    expect(document.querySelectorAll('button[aria-label^="Remove choice "]')).toHaveLength(4);
    await expect.element(input).toHaveValue("");
  });
});
