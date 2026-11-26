import { afterEach, expect, it } from "vite-plus/test";
// @effect-diagnostics experimentalApiUsage:off -- Effect UI is a public preview.
import { BrowserHost, Html } from "@effect/ui/html";
import { Effect, Exit, Schema, Scope } from "effect";

import { Message } from "../../../messages";
import type { RunnerState, RunnerTask } from "./runner";
import { taskRows } from "./runnerView";
import "../../../index.css";

const taskFixture = (orderIndex: number, count: number): RunnerTask => ({
  id: `task-${orderIndex}`,
  orderIndex,
  endDate: orderIndex === count ? null : orderIndex * 1_000,
  isBeingEdited: false,
  sections: [],
});

const runnerWith = (count: number): RunnerState => ({
  sessionId: "session",
  templateName: "Keyed rows",
  sessionName: "Keyed rows",
  startedAt: 0,
  now: 0,
  currentTaskId: `task-${count}`,
  completedCount: count - 1,
  focusedSectionId: null,
  showTaskList: false,
  showSidebar: true,
  showEndConfirm: false,
  lastError: null,
  fieldWrites: { revision: 0, pending: [] },
  announcement: null,
  tasks: Array.from({ length: count }, (_, index) => taskFixture(index + 1, count)),
});

/** Rows are named by their visible text: "Task 1 … Done". */
const taskButton = (index: number) =>
  [...document.querySelectorAll<HTMLElement>("button")].find((button) =>
    new RegExp(`^Task ${index}(?!\\d)`).test(button.textContent ?? ""),
  ) ?? null;
const firstTask = () => taskButton(1);

let scope: Scope.Closeable | undefined;

afterEach(async () => {
  if (scope !== undefined) await Effect.runPromise(Scope.close(scope, Exit.void));
  scope = undefined;
});

/** The task list for `count` tasks; Tick stands in for the store snapshot that follows recording one. */
const TaskRows = Html.component({
  name: "TaskRows",
  model: Schema.Struct({ count: Schema.Number }),
  message: Message,
}).make({
  init: () => ({ count: 2 }),
  update: ($, message) => (message._tag === "Tick" ? { count: message.now } : $.model),
  view: (h, model) => h.div.children(...taskRows(runnerWith(model.count), h)),
});

it("keeps keyboard focus on the same task when a newer task is added above it", async () => {
  const container = document.createElement("div");
  container.id = `task-rows-${crypto.randomUUID()}`;
  document.body.append(container);
  scope = Scope.makeUnsafe();
  const root = await Effect.runPromise(
    BrowserHost.mountEffect(TaskRows, {}, container).pipe(Scope.provide(scope)),
  );

  await expect.poll(firstTask).not.toBeNull();
  firstTask()!.focus();
  const focused = document.activeElement;
  expect(focused?.textContent).toMatch(/^Task 1(?!\d).*Done$/);

  root.send(Message.Tick({ now: 3 }));
  await expect.poll(() => taskButton(3)).not.toBeNull();

  expect(document.activeElement).toBe(focused);
  expect(document.activeElement?.textContent).toMatch(/^Task 1(?!\d).*Done$/);
});
