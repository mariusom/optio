import { afterEach, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { commitNow, openMemoryStore } from "../../../store/testStore";
import { tables } from "../../../store/tables";

import { mountApp } from "../../../app/testMount";
import { getStore } from "../../../store/client";
import { events } from "../../../store/schema";
import type { FieldDef } from "../../../domain/fields";
import "../../../index.css";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));

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

const flags = {
  assistantAccess: "unavailable",
  theme: "auto",
  style: "nova",
  font: "sans",
  iconLibrary: "hugeicons",
  accent: "default",
  look: "classic",
  controlSize: "standard",
  now: Date.now(),
  idSeed: "field-writes-test",
} as const;

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  history.replaceState(null, "", "#/");
});

const mount = async () => {
  const container = document.createElement("div");
  container.id = `field-writes-${crypto.randomUUID()}`;
  document.body.append(container);
  const mounted = await mountApp(flags, container);
  const unmount = async () => {
    await mounted.dispose();
    container.remove();
  };
  cleanups.push(unmount);
  return unmount;
};

// Real runtime, commands and event handlers on an in-memory journal;
// remounting the app stands in for a reload.
it("writes a typed answer in two events, keeps its first-keystroke time and survives a reload", async () => {
  await page.viewport(1440, 900);
  const store = await openMemoryStore();
  vi.mocked(getStore).mockResolvedValue(store);
  await commitNow(
    store,
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
  /** The answer values written so far, in order. */
  const writtenValues = () =>
    commit.mock.calls.flat().flatMap((event) => {
      const written = event as { name?: string; args?: { value?: string } };
      return written.name === "v2.TaskFieldValueChanged" ? [written.args?.value] : [];
    });
  const stored = () => store.query(tables.sessionTaskFields.select().where({ id: "t:a" }))[0]!;

  history.replaceState(null, "", "#/session/s");
  const unmount = await mount();
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
  // The first keystroke is written at once; the rest wait for a pause or blur.
  await expect.poll(() => writtenValues()[0]).toBe("T");
  const startDate = stored().startDate!.getTime();
  expect(startDate).toBeGreaterThanOrEqual(typingStarted);

  await userEvent.tab();
  await expect.poll(() => stored().value).toBe(text);
  // One more write carries the whole answer, whichever of the idle write (on a
  // loaded machine) or the blur sent it; no keystroke was written on its own.
  expect(writtenValues()).toEqual(["T", text]);
  // Later writes keep the first keystroke's time.
  expect(stored().startDate!.getTime()).toBe(startDate);

  // A pause writes the answer without leaving the field.
  await userEvent.type(input, "!");
  await expect.poll(() => stored().value, { timeout: 3_000 }).toBe(`${text}!`);
  expect(writtenValues()).toEqual(["T", text, `${text}!`]);

  await unmount();
  await mount();
  await expect.element(page.getByRole("textbox", { name: "Activity" })).toHaveValue(`${text}!`);
});
