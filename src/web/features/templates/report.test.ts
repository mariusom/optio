// @effect-diagnostics experimentalApiUsage:off -- Effect UI testing is a public preview.
import * as AsyncData from "@/lib/asyncData";
import { HtmlLocator } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { it as effectIt } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { ShowSheet } from "../../../components/app/sheet";
import { init, update, type Model } from "../../../main";
import { Message } from "../../../messages";
import type { TemplateReport, TemplateSummary } from "../../types";
import { viewScene } from "../viewScene";
import { templatesPage } from "./view";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));
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

const appModel: Model = {
  ...init("#/templates").model,
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

  it("records a failure for the open report only, and clears it on reopening", () => {
    const open = update(appModel, Message.OpenedTemplateReport({ id: "t1" })).model;
    const other = update(open, Message.FailedTemplateReport({ templateId: "t2" })).model;
    expect(other.templateReportFailed).toBe(false);
    const failed = update(open, Message.FailedTemplateReport({ templateId: "t1" })).model;
    expect(failed.templateReportFailed).toBe(true);
    const reopened = update(failed, Message.OpenedTemplateReport({ id: "t1" })).model;
    expect(reopened.templateReportFailed).toBe(false);
  });

  it("closes on Close and when the route changes", () => {
    const open = update(appModel, Message.OpenedTemplateReport({ id: "t1" })).model;
    expect(update(open, Message.ClosedTemplateReport()).model.templateReportFor).toBeNull();
    const moved = update(open, Message.GotRoute({ route: { _tag: "HistoryTab" } })).model;
    expect(moved.templateReportFor).toBeNull();
  });
});

type PageModel = Parameters<typeof templatesPage>[0];

/** The open sheet's focus and scroll handling runs as a Mount on its <dialog>. */
const showing = (model: PageModel, sheet: string = "template-report") =>
  viewScene((h) => templatesPage(model, h)).pipe(
    Effect.tap((s) => Effect.sync(() => s.expectMount(ShowSheet({ id: sheet })))),
  );

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
    templatesGrid: { query: "", sorting: [{ id: "name", desc: false }], filters: {} },
  };
  effectIt.effect("is offered in the template action sheet", () =>
    Effect.gen(function* () {
      const s = yield* showing(
        { ...model, templateActionsFor: "t1", templateReportFor: null },
        "template-actions",
      );
      s.click(HtmlLocator.role("button", { name: "Time report" })).emitted(
        Message.OpenedTemplateReport({ id: "t1" }),
      );
    }),
  );

  effectIt.effect("shows a loading status until the report arrives", () =>
    Effect.gen(function* () {
      const s = yield* showing(model);
      s.expect(HtmlLocator.role("status")).toHaveText("Loading report…");
    }),
  );

  effectIt.effect("shows a failure instead of loading forever", () =>
    Effect.gen(function* () {
      const s = yield* showing({ ...model, templateReportFailed: true });
      s.expect(HtmlLocator.role("alert"))
        .toHaveText("Couldn't load the report right now. Close it and try again.")
        .expect(Locator.text("Loading report…"))
        .toBeAbsent();
    }),
  );

  effectIt.effect("explains an empty report", () =>
    Effect.gen(function* () {
      const s = yield* showing({
        ...model,
        templateReport: { ...report, sessionCount: 0, totalMs: 0, tasks: [] },
      });
      s.expect(Locator.text("No finished sessions yet")).toExist();
    }),
  );

  effectIt.effect("totals sessions and tasks and breaks time down by answer", () =>
    Effect.gen(function* () {
      const s = yield* showing({ ...model, templateReport: report });
      s.expect(Locator.text("2 sessions · 3 tasks · 10m"))
        .toExist()
        .expect(Locator.text("Value-added"))
        .toExist()
        .expect(Locator.text(" · 60%"))
        .toExist()
        .expect(Locator.text("40s · 40%"))
        .toExist()
        .click(HtmlLocator.role("button", { name: "Close" }))
        .emitted(Message.ClosedTemplateReport());
    }),
  );
});
