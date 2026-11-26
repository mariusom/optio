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
import type { TemplateSummary } from "../../types";
import type { ActiveSession } from "../session/startHelpers";
import { viewScene } from "../viewScene";
import { templatesPage } from "./view";

vi.mock("../../../store/client", () => ({ getStore: vi.fn() }));
// The template action sheet starts a session with that template. Only one
// session can be live, so with one running the action resumes it instead,
// matching the Session tab, which shows "Resume session" in place of Start.

const template: TemplateSummary = {
  id: "t1",
  name: "Assembly line",
  isDefault: false,
  createdAt: 1,
  updatedAt: 1,
  fieldCount: 3,
  requiredCount: 1,
};

const live: ActiveSession = {
  id: "live-1",
  templateId: "t2",
  templateName: "Ward round",
  sessionName: "Night shift",
  startedAt: 1,
  completedCount: 2,
};

const baseModel = (activeSession: ActiveSession | null): Model => ({
  ...init("#/templates").model,
  templates: AsyncData.succeed([template]),
  activeSession: AsyncData.succeed(activeSession),
  templateActionsFor: template.id,
  placeholderName: "Brave otter",
});

describe("starting a session from the template action sheet", () => {
  it("starts a session with the template and closes the sheet", () => {
    const next = update(baseModel(null), Message.ClickedStartTemplateSession({ id: "t1" }));
    expect(next.model.templateActionsFor).toBeNull();
    expect(next.model.selectedTemplateId).toBe("t1");
    expect(next.commands).toEqual([
      expect.objectContaining({
        name: "StartSession",
        args: expect.objectContaining({
          templateId: "t1",
          templateName: "Assembly line",
          sessionName: "Brave otter",
          fields: [],
        }),
      }),
    ]);
  });

  it("opens the live session instead of starting a second one", () => {
    const next = update(baseModel(live), Message.ClickedStartTemplateSession({ id: "t1" }));
    expect(next.model.templateActionsFor).toBeNull();
    expect(next.commands).toEqual([
      expect.objectContaining({
        name: "NavigateInternal",
        args: { url: "#/session/live-1" },
      }),
    ]);
  });

  it("ignores a template that no longer exists", () => {
    const next = update(baseModel(null), Message.ClickedStartTemplateSession({ id: "gone" }));
    expect(next.model.templateActionsFor).toBeNull();
    expect(next.commands ?? []).toEqual([]);
  });

  it("asks for a session name when the sheet opens without one", () => {
    const model = { ...baseModel(null), templateActionsFor: null, placeholderName: "" };
    const next = update(model, Message.OpenedTemplateActions({ id: "t1" }));
    expect(next.model.templateActionsFor).toBe("t1");
    expect(next.commands).toEqual([expect.objectContaining({ name: "GeneratePlaceholderName" })]);
  });
});

type PageModel = Parameters<typeof templatesPage>[0];

/** The open sheet's focus and scroll handling runs as a Mount on its <dialog>. */
const showing = (model: PageModel, sheet: string = "template-actions") =>
  viewScene((h) => templatesPage(model, h)).pipe(
    Effect.tap((s) => Effect.sync(() => s.expectMount(ShowSheet({ id: sheet })))),
  );

describe("template action sheet", () => {
  const model: PageModel = {
    templates: [template],
    showCreate: false,
    newName: "",
    pendingDelete: null,
    templateActionsFor: template.id,
    lastError: null,
    liveSession: null,
    templatesGrid: { query: "", sorting: [{ id: "name", desc: false }], filters: {} },
  };
  effectIt.effect("lists Start session first", () =>
    Effect.gen(function* () {
      const s = yield* showing(model);
      s.click(HtmlLocator.role("button", { name: "Start session" })).emitted(
        Message.ClickedStartTemplateSession({ id: "t1" }),
      );
    }),
  );

  effectIt.effect("offers to resume the live session and explains why", () =>
    Effect.gen(function* () {
      const s = yield* showing({ ...model, liveSession: live });
      s.expect(HtmlLocator.role("button", { name: "Start session" }))
        .toBeAbsent()
        .expect(Locator.text("“Night shift” is still recording. End it to start another session."))
        .toExist()
        .click(HtmlLocator.role("button", { name: "Resume live session" }))
        .emitted(Message.ClickedStartTemplateSession({ id: "t1" }));
    }),
  );
});
