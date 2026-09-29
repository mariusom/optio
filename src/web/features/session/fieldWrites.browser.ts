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

const fields: FieldDef[] = [
  {
    id: "a",
    name: "Activity",
    kind: "textInput",
    isRequired: true,
    defaultValue: "",
    sortOrder: 0,
    options: [],
    exclusiveOptions: [],
  },
];

const flags = Effect.succeed({
  theme: "auto",
  style: "nova",
  font: "sans",
  iconLibrary: "hugeicons",
  accent: "default",
  now: Date.now(),
} as const);

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  history.replaceState(null, "", "#/");
});

const mount = () => {
  const container = document.createElement("div");
  container.id = `field-writes-${crypto.randomUUID()}`;
  document.body.append(container);
  const handle = Runtime.embed(
    Runtime.makeApplication({ ...applicationConfig, container, slow: false }),
    { flags },
  );
  const unmount = () => {
    handle.dispose();
    container.remove();
  };
  cleanups.push(unmount);
  return unmount;
};

// Real runtime, commands and SQLite materializers on LiveStore's in-memory
// adapter; remounting the app stands in for a reload.
it("writes a typed answer in two events, keeps its first-keystroke time and survives a reload", async () => {
  await page.viewport(1440, 900);
  const store = await createStorePromise({
    schema,
    storeId: `field-writes-${crypto.randomUUID()}`,
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
  const commit = vi.spyOn(store, "commit");
  const fieldWrites = () =>
    commit.mock.calls
      .flat()
      .filter((event) => (event as { name?: string }).name === "v2.TaskFieldValueChanged").length;
  const stored = () => store.query(tables.sessionTaskFields.select().where({ id: "t:a" }))[0]!;

  history.replaceState(null, "", "#/session/s");
  const unmount = mount();
  const input = page.getByRole("textbox", { name: "Activity" });
  await expect.element(input).toBeVisible();

  const text = "Tightened four bolts";
  const typingStarted = Date.now();
  // Dispatch the keystrokes back to back: `userEvent.type` can pause longer
  // than the write delay on a loaded machine, which would legitimately flush.
  const element = input.element() as HTMLInputElement;
  element.focus();
  for (const character of text) {
    element.value += character;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // Only the first keystroke is written while typing continues.
  await expect.poll(fieldWrites).toBe(1);
  expect(stored().value).toBe("T");
  const startDate = stored().startDate!.getTime();
  expect(startDate).toBeGreaterThanOrEqual(typingStarted);

  await userEvent.tab();
  await expect.poll(() => stored().value).toBe(text);
  expect(fieldWrites()).toBe(2);
  // Later writes keep the first keystroke's time.
  expect(stored().startDate!.getTime()).toBe(startDate);

  // A pause writes the answer without leaving the field.
  await userEvent.type(input, "!");
  await expect.poll(() => stored().value, { timeout: 3_000 }).toBe(`${text}!`);
  expect(fieldWrites()).toBe(3);

  unmount();
  mount();
  await expect.element(page.getByRole("textbox", { name: "Activity" })).toHaveValue(`${text}!`);
});
