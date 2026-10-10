import { Option } from "effect";
import { Scene } from "foldkit/test";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import { init, subscriptions, update, view, type Model } from "../main";
import { Message } from "../messages";

const at = (hash: string) =>
  init(Option.getOrThrow(fromString(`https://optio.test/#${hash}`))).model;

/** Applies store emissions the way subscriptions deliver them. */
const receive = (model: Model, ...messages: ReadonlyArray<Message>) =>
  messages.reduce((current, message) => update(current, message).model, model);

const template = {
  id: "t1",
  name: "Assembly line",
  isDefault: true,
  createdAt: 0,
  updatedAt: 0,
  fieldCount: 3,
  requiredCount: 1,
};

const active = {
  id: "s1",
  templateId: "t1",
  templateName: "Assembly line",
  sessionName: "Morning",
  startedAt: 0,
  completedCount: 2,
};

// Renders the whole app so the test covers the page composition, not one page.
const showing = (model: Model, ...steps: ReadonlyArray<Scene.SceneStep<Model, Message, never>>) =>
  Scene.scene(
    {
      update: (current: Model, _message: Message) => ({ model: current }),
      view: (current: Model, h) => view(current, h).body,
    },
    Scene.given(model),
    ...steps,
  );

describe("first load before the store has answered", () => {
  it("shows a loading state instead of an empty Start page", () =>
    showing(
      at("/start"),
      Scene.expect(Scene.text("Opening your studies…")).toExist(),
      Scene.expect(Scene.text("Start with a template")).toBeAbsent(),
    ));

  it("waits for both the open session and the templates before choosing a Start view", () => {
    const templatesOnly = receive(at("/start"), Message.GotTemplates({ templates: [template] }));
    showing(
      templatesOnly,
      Scene.expect(Scene.text("Opening your studies…")).toExist(),
      Scene.expect(Scene.text("New session")).toBeAbsent(),
    );
    showing(
      receive(templatesOnly, Message.GotActiveSession({ activeSession: active })),
      Scene.expect(Scene.text("In progress")).toExist(),
      Scene.expect(Scene.text("New session")).toBeAbsent(),
    );
  });

  it("shows empty states only once the store reports no rows", () => {
    showing(
      at("/templates"),
      Scene.expect(Scene.text("No templates yet")).toBeAbsent(),
      Scene.expect(Scene.text("Opening your studies…")).toExist(),
    );
    showing(
      receive(at("/templates"), Message.GotTemplates({ templates: [] })),
      Scene.expect(Scene.text("No templates yet")).toExist(),
    );
    showing(
      at("/history"),
      Scene.expect(Scene.text("No sessions yet")).toBeAbsent(),
      Scene.expect(Scene.text("Opening your studies…")).toExist(),
    );
    showing(
      receive(at("/history"), Message.GotHistory({ history: [] })),
      Scene.expect(Scene.text("No sessions yet")).toExist(),
    );
  });

  it("leaves the page to the storage notice when the store cannot open", () =>
    showing(
      receive(at("/start"), Message.StoreUnavailable()),
      Scene.expect(Scene.text("Opening your studies…")).toBeAbsent(),
      Scene.expect(Scene.role("button", { name: "Try again" })).toExist(),
    ));
});

const seedChecked = (model: Model) =>
  subscriptions.templates.modelToDependencies(model).seedChecked;

describe("first-run sample templates", () => {
  it("reads templates only after the startup seed check, so the first list is never pre-seed", () => {
    expect(seedChecked(at("/templates"))).toBe(false);
    expect(seedChecked(receive(at("/templates"), Message.TemplatesSeededCheck()))).toBe(true);
  });

  it("still reads templates when the seed check fails", () => {
    const failed = receive(
      at("/templates"),
      Message.FailedTemplateOp({ error: "Couldn’t create" }),
    );
    expect(seedChecked(failed)).toBe(true);
  });
});

const attempt = (model: Model) => subscriptions.history.modelToDependencies(model).attempt;

describe("a list that cannot be read", () => {
  it("offers to read it again instead of loading forever", () => {
    const failed = receive(at("/templates"), Message.FailedListRead({ list: "templates" }));
    showing(
      failed,
      Scene.expect(Scene.text("Opening your studies…")).toBeAbsent(),
      Scene.expect(Scene.role("alert")).toExist(),
      Scene.expect(Scene.role("button", { name: "Try again" })).toExist(),
    );
  });

  it("keeps rows it already shows", () => {
    const shown = receive(
      at("/templates"),
      Message.GotTemplates({ templates: [template] }),
      Message.FailedListRead({ list: "templates" }),
    );
    showing(shown, Scene.expect(Scene.text("Assembly line")).toExist());
  });

  it("blocks Start until the failed list is read again, then restarts the reads", () => {
    const failed = receive(
      at("/start"),
      Message.GotTemplates({ templates: [template] }),
      Message.FailedListRead({ list: "activeSession" }),
    );
    showing(failed, Scene.expect(Scene.role("button", { name: "Try again" })).toExist());

    const retried = receive(failed, Message.ClickedRetryListRead());
    expect(attempt(retried)).toBe(attempt(failed) + 1);
    showing(
      retried,
      Scene.expect(Scene.text("Opening your studies…")).toExist(),
      Scene.expect(Scene.role("button", { name: "Try again" })).toBeAbsent(),
    );
    // Lists that were read keep their rows through the retry.
    expect(retried.templates).toEqual(failed.templates);
  });
});
