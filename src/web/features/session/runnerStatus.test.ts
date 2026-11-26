import { Html } from "@effect/ui/html";
import { HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import type { H, Ui } from "@/lib/view";
import { planSession } from "../../../machine/session/sessionMachine";
import { Message } from "../../../messages";
import type { RunnerData, RunnerState } from "./runner";
import { sessionTimerView } from "./runnerStatus";

/** The rendered text of a fixed view, words joined by single spaces. */
const renderedText = (view: (h: H<Message>) => Ui) =>
  Effect.gen(function* () {
    const Static = Html.component({ name: "Static", model: Schema.Null, message: Message }).make({
      init: () => null,
      update: ($) => $.model,
      view: (h) => view(h),
    });
    const s = yield* HtmlScene.make(Static, {});
    const words = (node: Locator.Node): string =>
      node.tag === undefined && node.text !== undefined
        ? node.text
        : (node.children ?? []).map(words).join(" ");
    return words(s.root).replace(/\s+/g, " ").trim();
  });

const startedAt = 1_700_000_000_000;
const data = (firstAnswerAt: number | null): RunnerData => ({
  sessionId: "s",
  templateName: "Study",
  sessionName: "",
  startedAt,
  tasks: [
    {
      id: "t2",
      orderIndex: 2,
      endDate: null,
      isBeingEdited: false,
      sections: [
        {
          id: "f",
          taskId: "t2",
          name: "Activity",
          kind: "textInput",
          isRequired: false,
          defaultValue: "",
          sortOrder: 0,
          options: [],
          exclusiveOptions: [],
          value: firstAnswerAt === null ? "" : "Typing",
          startDate: firstAnswerAt,
        },
      ],
    },
  ],
  currentTaskId: "t2",
  completedCount: 1,
});

const runnerAt = (firstAnswerAt: number | null, now: number): RunnerState =>
  planSession({ runner: null, now }, { _tag: "DataSynced", data: data(firstAnswerAt) })
    .runner as RunnerState;

describe("runner clock", () => {
  it.effect("reads 00:00 for a task with no answer yet, not the session's time", () =>
    Effect.gen(function* () {
      const runner = runnerAt(null, startedAt + 95_000);
      const text = yield* renderedText((h) => sessionTimerView(runner, h));
      assert.strictEqual(text, "Task 2 00:00");
    }),
  );

  it.effect("times the task from its first answer", () =>
    Effect.gen(function* () {
      const runner = runnerAt(startedAt + 60_000, startedAt + 95_000);
      const text = yield* renderedText((h) => sessionTimerView(runner, h));
      assert.strictEqual(text, "Task 2 00:35");
    }),
  );
});
