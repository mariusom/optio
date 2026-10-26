import type { Html, HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vite-plus/test";

import { planSession } from "../../../machine/session/sessionMachine";
import { Message } from "../../../messages";
import type { RunnerData, RunnerState } from "./runner";
import { sessionTimerView } from "./runnerStatus";

const render = (view: (h: HtmlBuilder<Message>) => Html): Html => {
  let rendered: Html = null;
  Scene.scene(
    { update: (model: null, _message: Message) => ({ model }), view: (_model: null, h) => view(h) },
    Scene.given(null),
    (simulation: Scene.SceneSimulation<null, Message>) => {
      rendered = simulation.html;
      return simulation;
    },
  );
  return rendered;
};

const text = (node: Html | string): string => {
  if (typeof node === "string") return node;
  if (node === null) return "";
  return [node.text ?? "", ...(node.children ?? []).map((child) => text(child as Html | string))]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

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
  it("reads 00:00 for a task with no answer yet, not the session's time", () => {
    const clock = text(render((h) => sessionTimerView(runnerAt(null, startedAt + 95_000), h)));
    expect(clock).toBe("Task 2 00:00");
  });

  it("times the task from its first answer", () => {
    const runner = runnerAt(startedAt + 60_000, startedAt + 95_000);
    expect(text(render((h) => sessionTimerView(runner, h)))).toBe("Task 2 00:35");
  });
});
