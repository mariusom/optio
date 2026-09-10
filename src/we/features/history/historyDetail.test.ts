import { Effect, Option, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { beforeEach, vi } from "vitest";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

import { getStore } from "../../../livestore/client";
import { init, subscriptions, update } from "../../../main";
import { Message } from "../../../messages";
import { sessionDetailPage } from "./sessionDetailView";
import { taskDetailView } from "./taskDetailView";

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
  if (!node) return "";
  return [
    node.text ?? "",
    ...(node.children ?? []).map((child) => text(child as Html | string)),
  ].join(" ");
};
const task = (taskId: number, startedAt: number | null = null) => ({
  id: `task-${taskId}`,
  taskId,
  startedAt,
  endedAt: 100,
  sections: [],
});
const detail = {
  id: "s1",
  sessionName: "Study",
  templateName: "Template",
  startedAt: 0,
  endedAt: 100,
  taskCount: 3,
  tasks: [task(3, 1), task(2), task(1)],
};
const model = () => ({
  ...init({
    protocol: "https:",
    host: "example.com",
    port: Option.none(),
    pathname: "/",
    search: Option.none(),
    hash: Option.some("#/history/s1"),
  }).model,
  selectedHistorySession: detail,
});

beforeEach(() => vi.resetAllMocks());

describe("history detail regressions", () => {
  it.each(["subscription", "delete"])(
    "clears open detail UI after %s disappearance before opening another session",
    (source) => {
      let state = update(model(), Message.ClickedEditHistoryName()).model;
      state = update(state, Message.ChangedEditHistoryName({ text: "Unsaved rename" })).model;
      state = update(state, Message.ClickedHistoryTask({ taskId: "task-1" })).model;
      expect(state.showEditHistoryName).toBe(true);
      expect(state.selectedHistoryTaskId).toBe("task-1");
      Scene.scene(
        { view: sessionDetailPage, update },
        Scene.given(state),
        Scene.expect(Scene.role("dialog", { name: "Session name" })).toExist(),
        Scene.expect(Scene.role("dialog", { name: "Task 1" })).toExist(),
        Scene.expect(Scene.role("textbox", { name: "Name" })).toHaveValue("Unsaved rename"),
      );
      state = update(
        state,
        source === "subscription"
          ? Message.GotHistoryDetail({ detail: null })
          : Message.HistoryDeleted(),
      ).model;
      expect(state).toMatchObject({
        selectedHistorySession: null,
        selectedHistoryTaskId: null,
        showEditHistoryName: false,
        editHistoryNameInput: "",
      });
      state = update(state, Message.GotRoute({ route: { _tag: "HistoryTab" } })).model;
      state = update(
        state,
        Message.GotRoute({ route: { _tag: "SessionDetail", sessionId: "s2" } }),
      ).model;
      state = update(
        state,
        Message.GotHistoryDetail({ detail: { ...detail, id: "s2", sessionName: "Next" } }),
      ).model;
      expect(state).toMatchObject({
        selectedHistorySession: { id: "s2" },
        selectedHistoryTaskId: null,
        showEditHistoryName: false,
        editHistoryNameInput: "Next",
      });
      Scene.scene(
        { view: sessionDetailPage, update },
        Scene.given(state),
        Scene.expect(Scene.role("dialog")).toBeAbsent(),
        Scene.expect(Scene.role("textbox", { name: "Name" })).toBeAbsent(),
        Scene.expect(Scene.text("Unsaved rename")).toBeAbsent(),
      );
    },
  );

  it.each([null, detail])(
    "redirects missing or deleted detail to history (previous: %s)",
    (previous) => {
      const result = update(
        { ...model(), selectedHistorySession: previous },
        Message.GotHistoryDetail({ detail: null }),
      );
      expect(result.model.selectedHistorySession).toBeNull();
      expect(result.commands).toEqual([
        expect.objectContaining({ name: "NavigateInternal", args: { url: "#/history" } }),
      ]);
    },
  );

  it.effect.each([
    ["  New study \n", "New study"],
    [" \t\n ", ""],
  ])("trims rename %j before persistence", ([input, expected]) =>
    Effect.gen(function* () {
      const commit = vi.fn();
      vi.mocked(getStore).mockResolvedValue({ commit } as unknown as Awaited<
        ReturnType<typeof getStore>
      >);
      const result = update(
        { ...model(), editHistoryNameInput: input },
        Message.ConfirmedEditHistoryName(),
      );
      for (const command of result.commands ?? []) yield* command.effect;
      expect(commit).toHaveBeenCalledWith(
        expect.objectContaining({ args: { id: "s1", sessionName: expected } }),
      );
    }),
  );

  it.each(["textInput", "textArea", "boolean"])(
    "formats %s by section type in preview and task detail",
    (sectionType) => {
      for (const value of ["true", "false"]) {
        const recorded = {
          ...task(1),
          sections: [
            { sectionName: "Answer", value, sectionType, isRequired: false, startedAt: null },
          ],
        };
        const expected = sectionType === "boolean" ? (value === "true" ? "Yes" : "No") : value;
        for (const rendered of [
          render((h) => taskDetailView({ task: recorded }, h)),
          render((h) =>
            sessionDetailPage(
              { ...model(), selectedHistorySession: { ...detail, tasks: [recorded] } },
              h,
            ),
          ),
        ]) {
          expect(text(rendered).split(/\s+/)).toContain(expected);
          expect(text(rendered).split(/\s+/)).not.toContain(
            sectionType === "boolean" ? value : value === "true" ? "Yes" : "No",
          );
        }
      }
    },
  );

  it("renders taskId order even when earlier tasks have no start time", () => {
    const rendered = text(render((h) => sessionDetailPage(model(), h)));
    expect(rendered.indexOf("Task 1")).toBeLessThan(rendered.indexOf("Task 2"));
    expect(rendered.indexOf("Task 2")).toBeLessThan(rendered.indexOf("Task 3"));
  });

  it.effect.each([
    ["live session with null endedAt", null, null],
    ["live session with undefined endedAt", undefined, null],
    ["ended session", 100, expect.objectContaining({ id: "s1", endedAt: 100 })],
  ])("enforces ended-only detail for %s", ([_case, endedAt, expectedDetail]) =>
    Effect.gen(function* () {
      const callbacks: Array<(rows: ReadonlyArray<unknown>) => void> = [];
      vi.mocked(getStore).mockResolvedValue({
        subscribe: (_query: unknown, callback: (rows: ReadonlyArray<unknown>) => void) => {
          callbacks.push(callback);
          if (callbacks.length === 3) {
            callbacks[1]!([]);
            callbacks[2]!([]);
            callbacks[0]!([{ ...detail, endedAt }]);
          }
          return () => {};
        },
      } as unknown as Awaited<ReturnType<typeof getStore>>);

      const messages = yield* subscriptions.historyDetail
        .dependenciesToStream({ sessionId: "s1" })
        .pipe(Stream.take(1), Stream.runCollect);

      expect(messages[0]).toMatchObject({
        _tag: "GotHistoryDetail",
        detail: expectedDetail,
      });
    }),
  );

  it.effect("constructs history in taskId order and waits for the session query", () =>
    Effect.gen(function* () {
      const callbacks: Array<(rows: ReadonlyArray<unknown>) => void> = [];
      vi.mocked(getStore).mockResolvedValue({
        subscribe: (_query: unknown, callback: (rows: ReadonlyArray<unknown>) => void) => {
          callbacks.push(callback);
          if (callbacks.length === 3) {
            callbacks[1]!(detail.tasks.map((t) => ({ ...t, sessionId: "s1" })));
            callbacks[2]!([]);
            callbacks[0]!([detail]);
          }
          return () => {};
        },
      } as unknown as Awaited<ReturnType<typeof getStore>>);
      const messages = yield* subscriptions.historyDetail
        .dependenciesToStream({ sessionId: "s1" })
        .pipe(Stream.take(1), Stream.runCollect);
      expect(messages[0]).toMatchObject({
        _tag: "GotHistoryDetail",
        detail: { tasks: [{ taskId: 1 }, { taskId: 2 }, { taskId: 3 }] },
      });
    }),
  );
});
