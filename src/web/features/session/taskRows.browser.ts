import { afterEach, expect, it } from "vitest";
import { Schema } from "effect";
import { Port, Runtime, Subscription } from "foldkit";

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

const ports = { inbound: { recorded: Port.inbound(Schema.Number) } };
let handle: Runtime.EmbedHandle<typeof ports> | undefined;

afterEach(() => {
  handle?.dispose();
  handle = undefined;
});

it("keeps keyboard focus on the same task when a newer task is added above it", async () => {
  const container = document.createElement("div");
  container.id = `task-rows-${crypto.randomUUID()}`;
  document.body.append(container);
  handle = Runtime.embed(
    Runtime.makeElement({
      Model: Schema.Struct({ count: Schema.Number }),
      container,
      ports,
      slow: false,
      init: () => ({ model: { count: 2 } }),
      // Tick stands in for the store snapshot that follows recording a task.
      update: (model, message: Message) =>
        message._tag === "Tick" ? { model: { count: message.now } } : { model },
      view: (model, h) => h.div([], taskRows(runnerWith(model.count), h)),
      subscriptions: Subscription.make<{ readonly count: number }, Message>()(() => ({
        recorded: Port.subscriptionEntry(ports.inbound.recorded, (count) =>
          Message.Tick({ now: count }),
        ),
      })),
    }),
  );

  await expect.poll(firstTask).not.toBeNull();
  firstTask()!.focus();
  const focused = document.activeElement;
  expect(focused?.textContent).toMatch(/^Task 1(?!\d).*Done$/);

  handle.ports.recorded.send(3);
  await expect.poll(() => taskButton(3)).not.toBeNull();

  expect(document.activeElement).toBe(focused);
  expect(document.activeElement?.textContent).toMatch(/^Task 1(?!\d).*Done$/);
});
