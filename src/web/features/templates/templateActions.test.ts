import { AsyncData } from "foldkit";
import { Scene } from "foldkit/test";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it, vi } from "vitest";

import { ShowSheet } from "../../../components/app/sheet";
import { init, update, type Model } from "../../../main";
import { Message } from "../../../messages";
import type { TemplateSummary } from "../../types";
import type { ActiveSession } from "../session/startHelpers";
import { templatesPage } from "./view";

vi.mock("../../../livestore/client", () => ({ getStore: vi.fn() }));
// provide self for @livestore/adapter-web shared-worker stub (node env)
(globalThis as unknown as { self?: unknown }).self ??= globalThis;

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

const url = fromString("http://localhost/optio/#/templates");
const baseModel = (activeSession: ActiveSession | null): Model => ({
  ...init(Option.getOrThrow(url)).model,
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

/** The open sheet shows through a Mount; acknowledge it. */
const settleSheets = (simulation: Scene.SceneSimulation<PageModel, Message>) =>
  Scene.Mount.resolveAll(
    ...simulation.mounts.map(() => [ShowSheet, Message.SettledSheet()] as const),
  )(simulation);

describe("template action sheet", () => {
  const model: PageModel = {
    templates: [template],
    showCreate: false,
    newName: "",
    pendingDelete: null,
    templateActionsFor: template.id,
    lastError: null,
    liveSession: null,
  };
  const config = {
    view: templatesPage,
    update: (current: PageModel, message: Message) => ({ model: current, outMessage: message }),
  };

  it("lists Start session first", () => {
    Scene.scene(
      config,
      Scene.given(model),
      settleSheets,
      Scene.click(Scene.role("button", { name: "Start session" })),
      Scene.expectOutMessage(Message.ClickedStartTemplateSession({ id: "t1" })),
    );
  });

  it("offers to resume the live session and explains why", () => {
    Scene.scene(
      config,
      Scene.given({ ...model, liveSession: live }),
      settleSheets,
      Scene.expect(Scene.role("button", { name: "Start session" })).toBeAbsent(),
      Scene.expect(
        Scene.text("“Night shift” is still recording. End it to start another session."),
      ).toExist(),
      Scene.click(Scene.role("button", { name: "Resume live session" })),
      Scene.expectOutMessage(Message.ClickedStartTemplateSession({ id: "t1" })),
    );
  });
});
