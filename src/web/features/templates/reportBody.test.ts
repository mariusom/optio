import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vite-plus/test";

import type { TemplateReport } from "../../types";
import { ReportBody, ReportBodyMessage } from "./reportBody";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));

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

const loading = HtmlLocator.role("status");
const failure = HtmlLocator.role("alert");
const totals = Locator.attr("data-slot", "report-totals");

describe("ReportBody", () => {
  it.effect("reads its template's report and shows the totals and breakdown", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(ReportBody, { templateId: "t1" });
      assert.deepStrictEqual(s.subscriptions, ['report:"t1"']);
      s.expect(loading)
        .toHaveText("Loading report…")
        .subscription('report:"t1"', ReportBodyMessage.ChangedReport({ report }))
        .expect(totals)
        .toHaveText("2 sessions · 3 tasks · 10m")
        .expect(Locator.text("Time breakdown"))
        .toExist()
        .expect(Locator.text("Walking"))
        .toExist();
    }),
  );

  it.effect("switching template restarts the read and hides the old report", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(ReportBody, { templateId: "t1" });
      s.subscription('report:"t1"', ReportBodyMessage.ChangedReport({ report }))
        .props({ templateId: "t2" })
        .expect(totals)
        .toBeAbsent()
        .expect(loading)
        .toHaveText("Loading report…");
      assert.deepStrictEqual(s.subscriptions, ['report:"t2"']);
    }),
  );

  it.effect("shows a failed read until the report arrives", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(ReportBody, { templateId: "t1" });
      s.subscription('report:"t1"', ReportBodyMessage.FailedReport())
        .expect(failure)
        .toHaveText("Couldn't load the report right now. Close it and try again.")
        .subscription('report:"t1"', ReportBodyMessage.ChangedReport({ report }))
        .expect(failure)
        .toBeAbsent()
        .expect(totals)
        .toExist();
    }),
  );

  it.effect("explains an empty report", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(ReportBody, { templateId: "t1" });
      s.subscription(
        'report:"t1"',
        ReportBodyMessage.ChangedReport({ report: { ...report, sessionCount: 0, tasks: [] } }),
      )
        .expect(Locator.text("No finished sessions yet."))
        .toExist()
        .expect(totals)
        .toBeAbsent();
    }),
  );
});
