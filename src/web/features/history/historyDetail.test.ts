// @effect-diagnostics experimentalApiUsage:off -- Effect UI testing is a public preview.
import { Html } from "@effect/ui/html";
import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { Effect, Schema, Stream } from "effect";
import { describe, expect, it } from "@effect/vitest";
import { beforeEach, vi } from "vite-plus/test";

import type { H, Ui } from "@/lib/view";

import { ShowSheet } from "../../../components/app/sheet";
import { getStore } from "../../../store/client";
import { init, update } from "../../../main";
import { Message } from "../../../messages";
import { ExportSessionCsv } from "./historyCommands";
import * as historyHelpers from "./helpers";
import { historyPage } from "./historyView";
import { sessionDetailPage } from "./sessionDetailView";
import { taskDetailView } from "./taskDetailView";
import { viewScene } from "../viewScene";
import { runCommand, streamAt } from "../../../app/testSubscriptions";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));

/**
 * The rendered text of a fixed view, words joined by spaces. `start` skips
 * the end check, so the sheets' mounts need no acknowledgement.
 */
const text = (view: (h: H<Message>) => Ui): string => {
  const Static = Html.component({ name: "Static", model: Schema.Null, message: Message }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) => view(h),
  });
  const words = (node: Locator.Node): string =>
    node.tag === undefined && node.text !== undefined
      ? node.text
      : (node.children ?? []).map(words).join(" ");
  return words(HtmlScene.start(Static, {}).root);
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
  ...init("#/history/s1").model,
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
const firstDetail = Effect.suspend(() =>
  streamAt("#/history/s1", "historyDetail").pipe(Stream.take(1), Stream.runCollect),
);

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
      expect(
        await Effect.runPromise(ExportSessionCsv.make({ sessionId: "s1" }).effect),
      ).toMatchObject({
        _tag: "CsvExported",
      });
      expect(csv.mock.results[0]?.value).toBe(
        "id,A,B,C,D,E,F,startTime,endTime\n1,,false,true,true,,No,,",
      );
    } finally {
      csv.mockRestore();
    }
  });

  it.effect.each(["subscription", "delete"])(
    "clears open detail UI after %s disappearance before opening another session",
    (source) =>
      Effect.gen(function* () {
        let state = update(model(), Message.ClickedEditHistoryName()).model;
        state = update(state, Message.ChangedEditHistoryName({ text: "Unsaved rename" })).model;
        state = update(state, Message.ClickedHistoryTask({ taskId: "task-1" })).model;
        expect(state.showEditHistoryName).toBe(true);
        expect(state.selectedHistoryTaskId).toBe("task-1");
        const editing = state;
        const open = yield* viewScene((h) => sessionDetailPage(editing, h));
        open
          .expectMount(ShowSheet({ id: "edit-session-name" }))
          .expectMount(ShowSheet({ id: "history-task" }))
          .expect(HtmlLocator.role("dialog", { name: "Session name" }))
          .toExist()
          .expect(HtmlLocator.role("dialog", { name: "Task 1" }))
          .toExist()
          .expect(HtmlLocator.role("textbox", { name: "Name" }))
          .toHaveValue("Unsaved rename");
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
        const next = state;
        const closed = yield* viewScene((h) => sessionDetailPage(next, h));
        closed
          .expect(HtmlLocator.role("dialog"))
          .toBeAbsent()
          .expect(HtmlLocator.role("textbox", { name: "Name" }))
          .toBeAbsent()
          .expect(Locator.text("Unsaved rename"))
          .toBeAbsent();
      }),
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
      const commit = vi.fn(() => Effect.void);
      vi.mocked(getStore).mockResolvedValue({ commit } as unknown as Awaited<
        ReturnType<typeof getStore>
      >);
      const result = update(
        { ...model(), editHistoryNameInput: input },
        Message.ConfirmedEditHistoryName(),
      );
      for (const command of result.commands ?? []) yield* runCommand(command);
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
          text((h) => taskDetailView({ task: recorded }, h)),
          text((h) =>
            sessionDetailPage(
              { ...model(), selectedHistorySession: { ...detail, tasks: [recorded] } },
              h,
            ),
          ),
        ]) {
          expect(rendered.split(/\s+/)).toContain(expected);
          expect(rendered.split(/\s+/)).not.toContain(
            sectionType === "boolean" ? value : value === "true" ? "Yes" : "No",
          );
        }
      }
    },
  );

  it("breaks task time down by answer, after the summary", () => {
    const rendered = text((h) =>
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
    );
    expect(rendered).toContain("Time breakdown");
    expect(rendered).toContain("30s · 75%");
    expect(rendered).toContain("Unanswered");
    expect(rendered).toContain("10s · 25%");
    expect(rendered).not.toContain("Notes 40s");
    expect(rendered.indexOf("Summary")).toBeLessThan(rendered.indexOf("Time breakdown"));
  });

  it("omits the breakdown when no choice question was answered", () => {
    expect(text((h) => sessionDetailPage(model(), h))).not.toContain("Time breakdown");
  });

  it("shows seconds for short sessions and hours for long ones in the list", () => {
    const now = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const rendered = text((h) =>
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
          historyGrid: { query: "", sorting: [{ id: "started", desc: true }], filters: {} },
        },
        h,
      ),
    );
    expect(rendered).toContain("1 task");
    expect(rendered).toContain("6s");
    expect(rendered).toContain("1h 10m");
    expect(rendered).not.toMatch(/\b0m\b/);
    expect(rendered).toContain("Today, ");
    expect(rendered).toContain("2 sessions");
  });

  it("renders taskId order even when earlier tasks have no start time", () => {
    const rendered = text((h) => sessionDetailPage(model(), h));
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
