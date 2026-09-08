import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";
import { Runtime } from "foldkit";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import type {} from "@vitest/browser-playwright";

// These component tests exercise real views, messages and the production update
// machine. LiveStore's OPFS/workers are not booted: command execution and store
// notifications are replaced at the boundary, not the view or keyboard handlers.
vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { init, Model, subscriptions, update } from "../../../main";
import { Message } from "../../../messages";
import { sessionView } from "./sessionView";
import type { RunnerState } from "./runner";
import "../../../index.css";

const runnerFixture = (value: string, override: Partial<RunnerState> = {}): RunnerState => ({
  sessionId: "session",
  templateName: "Keyboard study",
  sessionName: "Keyboard accessibility",
  startedAt: 0,
  now: 0,
  currentTaskId: "task",
  completedCount: 0,
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: true,
  showEndConfirm: false,
  lastError: null,
  editBackup: null,
  tasks: [
    {
      id: "task",
      orderIndex: 1,
      endDate: null,
      isBeingEdited: false,
      sections: [
        {
          id: "activity",
          taskId: "task",
          name: "Activity",
          kind: "radio",
          isRequired: true,
          defaultValue: "",
          sortOrder: 0,
          options: ["Observe", "Assist", "Document"],
          exclusiveOptions: [],
          value,
          startDate: null,
        },
        {
          id: "notes",
          taskId: "task",
          name: "Notes",
          kind: "textInput",
          isRequired: false,
          defaultValue: "",
          sortOrder: 1,
          options: [],
          exclusiveOptions: [],
          value: "",
          startDate: null,
        },
        {
          id: "enabled",
          taskId: "task",
          name: "Enabled flag",
          kind: "boolean",
          isRequired: false,
          defaultValue: "false",
          sortOrder: 2,
          options: [],
          exclusiveOptions: [],
          value: "false",
          startDate: null,
        },
      ],
    },
  ],
  ...override,
});

let handle: Runtime.EmbedHandle | undefined;
let container: HTMLDivElement;
const changes: Array<{ taskFieldId: string; value: string }> = [];

const accessibleTaskNames = async () => {
  const { frameTree } = await cdp().send("Page.getFrameTree");
  const findFrame = (tree: typeof frameTree): string | undefined =>
    tree.frame.url === window.location.href
      ? tree.frame.id
      : tree.childFrames?.map(findFrame).find(Boolean);
  const frameId = findFrame(frameTree);
  expect(frameId).toBeDefined();
  const { nodes } = await cdp().send("Accessibility.getFullAXTree", { frameId });
  return nodes.filter((node) => !node.ignored).map((node) => node.name?.value);
};

const mount = async (
  width: number,
  value = "Observe",
  runnerOverride: Partial<RunnerState> = {},
) => {
  await page.viewport(width, 900);
  container = document.createElement("div");
  container.id = `runner-test-${crypto.randomUUID()}`;
  container.style.height = "900px";
  document.body.append(container);
  changes.length = 0;
  const model = init(Option.getOrThrow(fromString("https://example.com/#/session/session"))).model;
  handle = Runtime.embed(
    Runtime.makeElement({
      Model,
      container,
      init: () => ({
        model: {
          ...model,
          runner: runnerFixture(value, runnerOverride),
          runnerPhase: "collecting" as const,
        },
      }),
      view: (current, h) =>
        h.div([h.Class("app-shell focus-workspace h-full")], [sessionView(current, h)]),
      subscriptions: {
        focusedSectionScroll: subscriptions.focusedSectionScroll,
        currentTaskScroll: subscriptions.currentTaskScroll,
      },
      update: (current, message: Message) => {
        const result = update(current, message);
        if (message._tag !== "ChangedFieldValue") return result;
        changes.push({ taskFieldId: message.taskFieldId, value: message.value });
        expect(result.commands).toEqual([
          expect.objectContaining({
            name: "UpdateFieldValue",
            args: {
              taskFieldId: message.taskFieldId,
              value: message.value,
            },
          }),
        ]);
        // Simulate the store snapshot that would follow the emitted write command.
        const runner = result.model.runner!;
        return update(
          result.model,
          Message.GotRunnerData({
            data: {
              ...runner,
              tasks: runner.tasks.map((task) => ({
                ...task,
                sections: task.sections.map((section) =>
                  section.id === message.taskFieldId
                    ? { ...section, value: message.value }
                    : section,
                ),
              })),
            },
          }),
        );
      },
    }),
  );
  await expect.element(page.getByRole("radiogroup", { name: "Activity" })).toBeVisible();
};

afterEach(() => {
  handle?.dispose();
  container?.remove();
  vi.restoreAllMocks();
});

describe.each([390, 820, 1440])("runner keyboard at %ipx", (width) => {
  it("uses unique IDs, visible scroll targets and correctly associated switch labels", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const scrollTargets = () => scroll.mock.contexts.map((element) => (element as Element).id);
    await mount(width);
    const scope = width < 768 ? "mobile" : "tablet";
    await expect.poll(scrollTargets).toContain(`${scope}-formTop`);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids).toContain(`${scope}-runner-toggle-enabled-label`);
    expect(new Set(ids).size).toBe(ids.length);
    await page
      .getByRole("radiogroup", { name: "Activity" })
      .getByText("Assist", { exact: true })
      .click();
    await expect.poll(scrollTargets).toContain(`${scope}-notes`);
    expect(scrollTargets().every((id) => id.startsWith(`${scope}-`))).toBe(true);
    const label = document.querySelector<HTMLLabelElement>(
      `#${scope}-runner-toggle-enabled-label`,
    )!;
    const control = document.querySelector<HTMLButtonElement>(
      `[role="switch"][aria-labelledby="${label.id}"]`,
    )!;
    expect(control).not.toBeNull();
    expect(label.textContent).toBe("No");
    label.click();
    await expect.poll(() => changes.at(-1)).toEqual({ taskFieldId: "enabled", value: "true" });
    await expect.element(page.getByRole("switch", { name: "Yes" })).toBeChecked();
  });

  it.each(["Assist", ""])(
    "native group wraps, updates and has one tab stop (initial %s)",
    async (initial) => {
      await mount(width, initial);
      const scope = width < 768 ? "mobile" : "tablet";
      const radio = (value: string) =>
        document.querySelector<HTMLInputElement>(
          `input[name="${scope}-activity"][value="${value}"]`,
        )!;
      await page.getByRole("textbox", { name: "Notes" }).click();
      await userEvent.tab({ shift: true });
      if (initial !== "") expect(document.activeElement).toBe(radio(initial));
      else expect(document.activeElement?.getAttribute("name")).toBe(`${scope}-activity`);
      await userEvent.tab({ shift: true });
      expect(document.activeElement?.getAttribute("type")).not.toBe("radio");
      await userEvent.tab();
      if (initial !== "") expect(document.activeElement).toBe(radio(initial));
      else expect(document.activeElement?.getAttribute("name")).toBe(`${scope}-activity`);
      await userEvent.tab();
      await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveFocus();
      radio("Observe").focus();
      await userEvent.keyboard(" ");
      await expect.poll(() => changes.at(-1)?.value).toBe("Observe");
      for (const [key, value] of [
        ["ArrowRight", "Assist"],
        ["ArrowDown", "Document"],
        ["ArrowRight", "Observe"],
        ["ArrowLeft", "Document"],
        ["ArrowUp", "Assist"],
        ["ArrowUp", "Observe"],
      ]) {
        await userEvent.keyboard(`{${key}}`);
        await expect.poll(() => changes.at(-1)).toEqual({ taskFieldId: "activity", value });
        await expect.poll(() => document.activeElement).toBe(radio(value!));
        expect(radio(value!).checked).toBe(true);
        expect(document.querySelectorAll(`input[name="${scope}-activity"]:checked`)).toHaveLength(
          1,
        );
        // The hidden responsive copy must not uncheck the visible copy.
        expect(document.querySelectorAll('input[type="radio"]:checked')).toHaveLength(2);
      }
      await userEvent.tab();
      await expect.element(page.getByRole("textbox", { name: "Notes" })).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(document.activeElement).toBe(radio("Observe"));
      await userEvent.tab({ shift: true });
      expect(document.activeElement?.getAttribute("type")).not.toBe("radio");
    },
  );
});

describe.each([390, 820])("runner actions at %ipx", (width) => {
  const taskOverride = (value: string, endDate: number, isBeingEdited: boolean) => {
    const task = runnerFixture(value).tasks[0]!;
    return { tasks: [{ ...task, endDate, isBeingEdited }] } satisfies Partial<RunnerState>;
  };

  it("disables Record for a completed task that is not being edited", async () => {
    await mount(width, "Observe", taskOverride("Observe", 1_000, false));
    await expect.element(page.getByRole("button", { name: "Record task" })).toBeDisabled();
  });

  it("enables Save for a completed, filled task being edited", async () => {
    await mount(width, "Observe", taskOverride("Observe", 1_000, true));
    await expect.element(page.getByRole("button", { name: /Save/ })).toBeEnabled();
  });

  it("disables Save when an edited task is missing a required value", async () => {
    await mount(width, "", taskOverride("", 1_000, true));
    await expect.element(page.getByRole("button", { name: /Save/ })).toBeDisabled();
  });
});

describe.each([820, 1440])("task sidebar at %ipx", (width) => {
  it("removes collapsed descendants from focus and accessibility, then restores them", async () => {
    await mount(width);
    const sidebar = document.querySelector<HTMLElement>("#runner-task-sidebar")!;
    const task = sidebar.querySelector<HTMLButtonElement>("button")!;
    const toggle = page.getByRole("button", { name: "Collapse sidebar" });
    expect(toggle.element().getAttribute("aria-expanded")).toBe("true");
    expect(toggle.element().getAttribute("aria-controls")).toBe("runner-task-sidebar");
    await toggle.click();
    await expect.poll(() => sidebar.inert).toBe(true);
    expect(
      page.getByRole("button", { name: "Expand sidebar" }).element().getAttribute("aria-expanded"),
    ).toBe("false");
    expect(await accessibleTaskNames()).not.toContain("Task 1 in progress");
    expect(await accessibleTaskNames()).not.toContain("Task navigation sidebar");
    task.focus();
    expect(document.activeElement).not.toBe(task);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute("type")).toBe("radio");
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect.poll(() => sidebar.inert).toBe(false);
    expect(await accessibleTaskNames()).toContain("Task 1 in progress");
    await expect
      .element(page.getByRole("complementary", { name: "Task navigation sidebar" }))
      .toBeVisible();
    // The sidebar column precedes the nav bar, so tabbing forward leaves it;
    // what matters is that its rows take focus again.
    task.focus();
    expect(document.activeElement).toBe(task);
    await expect.element(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  });
});
