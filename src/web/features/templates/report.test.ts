import { AsyncData } from "foldkit";
import { Scene } from "foldkit/test";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it, vi } from "vitest";

import { ShowSheet } from "../../../components/app/sheet";
import { init, update, type Model } from "../../../main";
import { Message } from "../../../messages";
import type { TemplateReport, TemplateSummary } from "../../types";
import { templatesPage } from "./view";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));
// provide self for @livestore/adapter-web shared-worker stub (node env)
(globalThis as unknown as { self?: unknown }).self ??= globalThis;

// A template's time report: the session-detail breakdown summed over every
// finished session recorded with that template, opened from its action sheet.

const template: TemplateSummary = {
  id: "t1",
  name: "Assembly line",
  isDefault: false,
  createdAt: 1,
  updatedAt: 1,
  fieldCount: 2,
  requiredCount: 1,
};

const task = (ms: number, type: string) => ({
  startedAt: 0,
  endedAt: ms,
  sections: [{ sectionName: "Task type", value: type, sectionType: "radio" }],
});

const report: TemplateReport = {
  templateId: "t1",
  sessionCount: 2,
  totalMs: 600_000,
  tasks: [task(30_000, "Walking"), task(60_000, "Value-added"), task(10_000, "Walking")],
};

const url = fromString("http://localhost/optio/#/templates");
const appModel: Model = {
  ...init(Option.getOrThrow(url)).model,
  templates: AsyncData.succeed([template]),
  templateActionsFor: template.id,
};

describe("template report state", () => {
  it("opens from the action sheet, replacing it", () => {
    const next = update(appModel, Message.OpenedTemplateReport({ id: "t1" })).model;
    expect(next.templateActionsFor).toBeNull();
    expect(next.templateReportFor).toBe("t1");
    expect(next.templateReport).toBeNull();
  });

  it("keeps data only for the template whose report is open", () => {
    const open = update(appModel, Message.OpenedTemplateReport({ id: "t1" })).model;
    const stale = { ...report, templateId: "t2" };
    expect(
      update(open, Message.GotTemplateReport({ report: stale })).model.templateReport,
    ).toBeNull();
    expect(update(open, Message.GotTemplateReport({ report })).model.templateReport).toEqual(
      report,
    );
  });

  it("closes on Close and when the route changes", () => {
    const open = update(appModel, Message.OpenedTemplateReport({ id: "t1" })).model;
    expect(update(open, Message.ClosedTemplateReport()).model.templateReportFor).toBeNull();
    const moved = update(open, Message.GotRoute({ route: { _tag: "HistoryTab" } })).model;
    expect(moved.templateReportFor).toBeNull();
  });
});

type PageModel = Parameters<typeof templatesPage>[0];

const settleSheets = (simulation: Scene.SceneSimulation<PageModel, Message>) =>
  Scene.Mount.resolveAll(
    ...simulation.mounts.map(() => [ShowSheet, Message.SettledSheet()] as const),
  )(simulation);

describe("template report sheet", () => {
  const model: PageModel = {
    templates: [template],
    showCreate: false,
    newName: "",
    pendingDelete: null,
    templateActionsFor: null,
    templateReportFor: "t1",
    templateReport: null,
    lastError: null,
    liveSession: null,
  };
  const config = {
    view: templatesPage,
    update: (current: PageModel, message: Message) => ({ model: current, outMessage: message }),
  };

  it("is offered in the template action sheet", () => {
    Scene.scene(
      config,
      Scene.given({ ...model, templateActionsFor: "t1", templateReportFor: null }),
      settleSheets,
      Scene.click(Scene.role("button", { name: "Time report" })),
      Scene.expectOutMessage(Message.OpenedTemplateReport({ id: "t1" })),
    );
  });

  it("shows a loading status until the report arrives", () => {
    Scene.scene(
      config,
      Scene.given(model),
      settleSheets,
      Scene.expect(Scene.role("status")).toHaveText("Loading report…"),
    );
  });

  it("explains an empty report", () => {
    Scene.scene(
      config,
      Scene.given({
        ...model,
        templateReport: { ...report, sessionCount: 0, totalMs: 0, tasks: [] },
      }),
      settleSheets,
      Scene.expect(Scene.text(/No finished sessions yet/)).toExist(),
    );
  });

  it("totals sessions and tasks and breaks time down by answer", () => {
    Scene.scene(
      config,
      Scene.given({ ...model, templateReport: report }),
      settleSheets,
      Scene.expect(Scene.text("2 sessions · 3 tasks · 10m")).toExist(),
      Scene.expect(Scene.text("Value-added")).toExist(),
      Scene.expect(Scene.text(/ · 60%$/)).toExist(),
      Scene.expect(Scene.text("40s · 40%")).toExist(),
      Scene.click(Scene.role("button", { name: "Close" })),
      Scene.expectOutMessage(Message.ClosedTemplateReport()),
    );
  });
});
