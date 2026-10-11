import { Effect, Option, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { beforeEach, vi } from "vitest";

import { ShowSheet } from "../../../components/app/sheet";
import { getStore } from "../../../livestore/client";
import { init, subscriptions, update } from "../../../main";
import { Message } from "../../../messages";
import { ExportSessionCsv } from "./historyCommands";
import * as historyHelpers from "./helpers";
import { historyPage } from "./historyView";
import { sessionDetailPage } from "./sessionDetailView";
import { taskDetailView } from "./taskDetailView";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));

/** Open sheets show through a Mount; acknowledge each one. */
const settleSheets = <Model>(simulation: Scene.SceneSimulation<Model, Message>) =>
  Scene.Mount.resolveAll(
    ...simulation.mounts.map(() => [ShowSheet, Message.SettledSheet()] as const),
  )(simulation);

const render = (view: (h: HtmlBuilder<Message>) => Html): Html => {
  let rendered: Html = null;
  Scene.scene(
    { update: (model: null, _message: Message) => ({ model }), view: (_model: null, h) => view(h) },
    Scene.given(null),
    settleSheets,
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

const listSession = (id: string, startedAt: number, durationMs: number) => ({
  id,
  displayName: id,
  templateName: "Template",
  sessionName: "",
  startedAt,
  endedAt: startedAt + durationMs,
  taskCount: 1,
});

beforeEach(() => vi.resetAllMocks());

const archiveSession = (endedAt: Date | null) => ({
  id: "s1",
  sessionName: "Study",
  templateName: "Template",
  startedAt: new Date(0),
  endedAt,
});
const subscribeWith = (result: unknown) =>
  vi.mocked(getStore).mockResolvedValue({
    subscribe: (_query: unknown, callback: (rows: unknown) => void) => {
      callback(result);
      return () => {};
    },
  } as unknown as Awaited<ReturnType<typeof getStore>>);
const firstDetail = subscriptions.historyDetail
  .dependenciesToStream({ sessionId: "s1" })
  .pipe(Stream.take(1), Stream.runCollect);

const archiveRecord = (taskId: number) => ({
  id: `r${taskId}`,
  taskId,
  startedAt: null,
  endedAt: new Date(100),
});
const archiveSection = (taskRecordId: string, sectionName: string) => ({
  taskRecordId,
  sectionName,
  value: "",
  sectionType: "textInput",
  isRequired: 0,
  startedAt: null,
});

describe("history detail regressions", () => {
  it("exports yes/no answers as true/false and keeps unanswered empty", async () => {
    const query = vi.fn().mockReturnValueOnce({
      session: { id: "s1", sessionName: "Study", templateName: "Template" },
      records: [{ id: "t1", taskId: 1, startedAt: null, endedAt: null }],
      sections: [
        { taskRecordId: "t1", sectionName: "A", sectionType: "boolean", value: "" },
        { taskRecordId: "t1", sectionName: "B", sectionType: "boolean", value: "false" },
        { taskRecordId: "t1", sectionName: "C", sectionType: "boolean", value: "true" },
        { taskRecordId: "t1", sectionName: "D", sectionType: "boolean", value: " TRUE " },
        { taskRecordId: "t1", sectionName: "E", sectionType: "textInput", value: "" },
        { taskRecordId: "t1", sectionName: "F", sectionType: "textInput", value: "No" },
      ],
    });
    vi.mocked(getStore).mockResolvedValue({ query } as unknown as Awaited<
      ReturnType<typeof getStore>
    >);
    const csv = vi.spyOn(historyHelpers, "buildArchiveCsv");
    try {
      expect(await Effect.runPromise(ExportSessionCsv({ sessionId: "s1" }).effect)).toMatchObject({
        _tag: "CsvExported",
      });
      expect(csv.mock.results[0]?.value).toBe(
        "id,A,B,C,D,E,F,startTime,endTime\n1,,false,true,true,,No,,",
      );
    } finally {
      csv.mockRestore();
    }
  });

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
        settleSheets,
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

  it("breaks task time down by answer, after the summary", () => {
    const answered = (taskId: number, durationMs: number, value: string) => ({
      ...task(taskId, 0),
      endedAt: durationMs,
      sections: [
        { sectionName: "Activity", value, sectionType: "radio", isRequired: false, startedAt: 0 },
        {
          sectionName: "Notes",
          value: "x",
          sectionType: "textInput",
          isRequired: false,
          startedAt: 0,
        },
      ],
    });
    const rendered = text(
      render((h) =>
        sessionDetailPage(
          {
            ...model(),
            selectedHistorySession: {
              ...detail,
              tasks: [answered(1, 30_000, "Walk"), answered(2, 10_000, "")],
            },
          },
          h,
        ),
      ),
    );
    expect(rendered).toContain("Time breakdown");
    expect(rendered).toContain("30s · 75%");
    expect(rendered).toContain("Unanswered");
    expect(rendered).toContain("10s · 25%");
    expect(rendered).not.toContain("Notes 40s");
    expect(rendered.indexOf("Summary")).toBeLessThan(rendered.indexOf("Time breakdown"));
  });

  it("omits the breakdown when no choice question was answered", () => {
    expect(text(render((h) => sessionDetailPage(model(), h)))).not.toContain("Time breakdown");
  });

  it("shows seconds for short sessions in the list, with day totals", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const rendered = text(
      render((h) =>
        historyPage(
          {
            history: [
              listSession("a", now - 60_000, 6_000),
              listSession("b", now - 7_200_000, 4_200_000),
            ],
            now,
            pendingHistoryDelete: null,
            historyActionsFor: null,
            historyError: null,
          },
          h,
        ),
      ),
    );
    // The duration sits under the start time, not in the truncating subtitle.
    expect(rendered).toContain("1 task");
    expect(rendered).not.toContain("1 task · 6s");
    expect(rendered).toContain("6s");
    expect(rendered).not.toMatch(/\b0m\b/);
    expect(rendered).toContain("Today");
    expect(rendered).toContain("· 2 sessions · 1h 10m");
  });

  it("renders taskId order even when earlier tasks have no start time", () => {
    const rendered = text(render((h) => sessionDetailPage(model(), h)));
    expect(rendered.indexOf("Task 1")).toBeLessThan(rendered.indexOf("Task 2"));
    expect(rendered.indexOf("Task 2")).toBeLessThan(rendered.indexOf("Task 3"));
  });

  it.effect.each([
    ["missing session", undefined, null],
    ["live session", null, null],
    ["ended session", new Date(100), expect.objectContaining({ id: "s1", endedAt: 100 })],
  ])("enforces ended-only detail for %s", ([_case, endedAt, expectedDetail]) =>
    Effect.gen(function* () {
      subscribeWith({
        session: endedAt === undefined ? null : archiveSession(endedAt as Date | null),
        records: [],
        sections: [],
      });
      const messages = yield* firstDetail;
      expect(messages[0]).toMatchObject({
        _tag: "GotHistoryDetail",
        detail: expectedDetail,
      });
    }),
  );

  it.effect("groups ordered answers under their task records", () =>
    Effect.gen(function* () {
      subscribeWith({
        session: archiveSession(new Date(100)),
        records: [archiveRecord(1), archiveRecord(2)],
        sections: [archiveSection("r1", "A"), archiveSection("r1", "B"), archiveSection("r2", "A")],
      });
      const messages = yield* firstDetail;
      expect(messages[0]).toMatchObject({
        _tag: "GotHistoryDetail",
        detail: {
          taskCount: 2,
          tasks: [
            { taskId: 1, sections: [{ sectionName: "A" }, { sectionName: "B" }] },
            { taskId: 2, sections: [{ sectionName: "A" }] },
          ],
        },
      });
    }),
  );
});
