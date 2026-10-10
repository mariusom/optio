import { afterEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Runtime } from "foldkit";
import { Effect } from "effect";
import { createStorePromise } from "@livestore/livestore";
import { makeInMemoryAdapter } from "@livestore/adapter-web";

import { applicationConfig } from "../../../application";
import { getStore } from "../../../livestore/client";
import { events, schema, tables } from "../../../livestore/schema";
import type { FieldDef } from "../../../domain/fields";
import "../../../index.css";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

const field = (overrides: Partial<FieldDef> & Pick<FieldDef, "id" | "name">): FieldDef => ({
  kind: "textInput",
  isRequired: true,
  defaultValue: "",
  sortOrder: 0,
  options: [],
  exclusiveOptions: [],
  ...overrides,
});

const fields: FieldDef[] = [
  field({ id: "a", name: "Activity", kind: "radio", options: ["Observe", "Assist"] }),
  field({ id: "s", name: "Station", sortOrder: 1 }),
  field({ id: "n", name: "Notes", kind: "textArea", isRequired: false, sortOrder: 2 }),
];

const flags = Effect.succeed({
  theme: "auto",
  style: "nova",
  font: "sans",
  iconLibrary: "hugeicons",
  accent: "default",
  look: "classic",
  controlSize: "standard",
  now: Date.now(),
  idSeed: "repeat-answers-test",
} as const);

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  history.replaceState(null, "", "#/");
  vi.restoreAllMocks();
});

const mount = () => {
  const container = document.createElement("div");
  container.id = `repeat-answers-${crypto.randomUUID()}`;
  container.style.height = "900px";
  document.body.append(container);
  const handle = Runtime.embed(
    Runtime.makeApplication({ ...applicationConfig, container, slow: false }),
    { flags },
  );
  cleanups.push(() => {
    handle.dispose();
    container.remove();
  });
};

const openStore = async () => {
  const store = await createStorePromise({
    schema,
    storeId: `repeat-answers-${crypto.randomUUID()}`,
    adapter: makeInMemoryAdapter(),
  });
  cleanups.push(() => void store.shutdownPromise?.());
  vi.mocked(getStore).mockResolvedValue(store);
  store.commit(
    events.sessionStarted({
      id: "s",
      templateId: null,
      templateName: "Study",
      sessionName: "Line 4",
      now: new Date(),
    }),
    events.taskSpawned({ sessionId: "s", id: "t", orderIndex: 1, fields }),
  );
  return store;
};

// Real runtime, commands and SQLite materializers on LiveStore's in-memory adapter.
it.each([390, 1184])(
  "shows required progress, confirms a recording and repeats answers in one write (%ipx)",
  async (width) => {
    await page.viewport(width, 900);
    const store = await openStore();
    const vibrate = vi.spyOn(Navigator.prototype, "vibrate").mockReturnValue(true);
    history.replaceState(null, "", "#/session/s");
    mount();

    // Required progress and the visible reason Record is disabled.
    const progress = page.getByRole("progressbar", { name: "Required answers" });
    await expect.element(progress).toBeVisible();
    expect(progress.element().getAttribute("aria-valuetext")).toBe("0 of 2 required answered");
    await expect
      .element(
        page.getByRole("status").filter({ hasText: "Answer the 2 required questions first." }),
      )
      .toBeVisible();
    const record = page.getByRole("button", { name: "Record task" });
    await expect.element(record).toHaveAttribute("aria-disabled", "true");
    const repeat = page.getByRole("button", { name: "Repeat last answers" });
    await expect.element(repeat).toHaveAttribute("aria-disabled", "true");
    await expect
      .element(repeat)
      .toHaveAccessibleDescription("No earlier task to copy answers from yet.");

    // A neutral End action with a 44px target.
    const end = page.getByRole("button", { name: "End session", exact: true }).element();
    expect(end.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(end.className).not.toMatch(/emerald|success/);

    await page.getByRole("radiogroup", { name: "Activity" }).getByText("Observe").click();
    await expect.element(progress).toHaveAttribute("aria-valuetext", "1 of 2 required answered");
    await userEvent.type(page.getByRole("textbox", { name: "Station" }), "B4");
    await userEvent.tab();
    await expect.element(progress).not.toBeInTheDocument();
    await record.click();

    const status = page.getByRole("status").filter({ hasText: "recorded" });
    await expect.element(status).toHaveTextContent("Task 1 recorded");
    expect(status.element().getAttribute("aria-live")).toBe("polite");
    await expect.poll(() => vibrate.mock.calls).toEqual([[30]]);
    const toggle = page.getByRole("button", { name: /^1 task recorded/ });
    await expect.element(toggle).toHaveTextContent("1 task");
    const count = toggle.element().querySelector('[data-slot="task-count"]')!;
    expect(count.className).toContain("motion-safe:animate-in");

    // Task 2: copy both answers in one batch of first writes.
    await expect.element(repeat).not.toHaveAttribute("aria-disabled");
    await expect.element(repeat).toHaveAccessibleDescription("Fills 2 empty answers from task 1.");
    const commit = vi.spyOn(store, "commit");
    const before = Date.now();
    await repeat.click();
    await expect
      .element(page.getByRole("status").filter({ hasText: "Filled" }))
      .toHaveTextContent("Filled 2 answers from task 1");
    // The confirmation replaced the recording one, and the counter settled.
    expect(count.isConnected && count.className.includes("animate-in")).toBe(false);

    const task2 = store.query(
      tables.sessionTasks.select().where({ sessionId: "s", orderIndex: 2 }),
    )[0]!;
    const stored = () =>
      store
        .query(
          tables.sessionTaskFields.select().where({ taskId: task2.id }).orderBy("sortOrder", "asc"),
        )
        .map((row) => [
          row.value,
          row.startDate === null ? null : row.startDate.getTime() >= before,
        ]);
    await expect.poll(stored).toEqual([
      ["Observe", true],
      ["B4", true],
      ["", null],
    ]);
    const writes = commit.mock.calls.filter((call) =>
      call.some((event) => (event as { name?: string }).name === "v2.TaskFieldValueChanged"),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveLength(2);

    await expect.element(record).not.toHaveAttribute("aria-disabled");
    await expect.element(repeat).toHaveAttribute("aria-disabled", "true");
    await expect.element(repeat).toHaveAccessibleDescription("Nothing left to fill from task 1.");
  },
);
