import { HtmlLocator } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { init, subscriptions, update, type Model } from "../main";
import { appScene } from "./appScene";
import { Message } from "../messages";

const at = (hash: string) => init(`#${hash}`).model;

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

describe("first load before the store has answered", () => {
  it("shows a loading state instead of an empty Start page", () =>
    void appScene(at("/start"))
      .expect(Locator.text("Opening your studies…"))
      .toExist()
      .expect(Locator.text("Start with a template"))
      .toBeAbsent());

  it("waits for both the open session and the templates before choosing a Start view", () => {
    const templatesOnly = receive(at("/start"), Message.GotTemplates({ templates: [template] }));
    appScene(templatesOnly)
      .expect(Locator.text("Opening your studies…"))
      .toExist()
      .expect(Locator.text("New session"))
      .toBeAbsent();
    appScene(receive(templatesOnly, Message.GotActiveSession({ activeSession: active })))
      .expect(Locator.text("In progress"))
      .toExist()
      .expect(Locator.text("New session"))
      .toBeAbsent();
  });

  it("shows empty states only once the store reports no rows", () => {
    appScene(at("/templates"))
      .expect(Locator.text("No templates yet"))
      .toBeAbsent()
      .expect(Locator.text("Opening your studies…"))
      .toExist();
    appScene(receive(at("/templates"), Message.GotTemplates({ templates: [] })))
      .expect(Locator.text("No templates yet"))
      .toExist();
    appScene(at("/history"))
      .expect(Locator.text("No sessions yet"))
      .toBeAbsent()
      .expect(Locator.text("Opening your studies…"))
      .toExist();
    appScene(receive(at("/history"), Message.GotHistory({ history: [] })))
      .expect(Locator.text("No sessions yet"))
      .toExist();
  });

  it("leaves the page to the storage notice when the store cannot open", () =>
    void appScene(receive(at("/start"), Message.StoreUnavailable()))
      .expect(Locator.text("Opening your studies…"))
      .toBeAbsent()
      .expect(HtmlLocator.role("button", { name: "Try again" }))
      .toExist());
});

const seedChecked = (model: Model) =>
  subscriptions(model).some((subscription) => subscription && subscription.name === "templates");

describe("first-run sample templates", () => {
  it("reads templates only after the startup seed check, so the first list is never pre-seed", () => {
    expect(seedChecked(at("/templates"))).toBe(false);
    expect(seedChecked(receive(at("/templates"), Message.SucceededEnsureTemplatesSeeded()))).toBe(
      true,
    );
  });

  it("still reads templates when the seed check fails", () => {
    const failed = receive(
      at("/templates"),
      Message.FailedTemplateOp({ error: "Couldn’t create" }),
    );
    expect(seedChecked(failed)).toBe(true);
  });
});

const historyKey = (model: Model) => {
  const history = subscriptions(model).find(
    (subscription) => subscription && subscription.name === "history",
  );
  return history === undefined || history === false ? undefined : history.key;
};

describe("a list that cannot be read", () => {
  it("offers to read it again instead of loading forever", () => {
    const failed = receive(at("/templates"), Message.FailedListRead({ list: "templates" }));
    appScene(failed)
      .expect(Locator.text("Opening your studies…"))
      .toBeAbsent()
      .expect(HtmlLocator.role("alert"))
      .toExist()
      .expect(HtmlLocator.role("button", { name: "Try again" }))
      .toExist();
  });

  it("keeps rows it already shows", () => {
    const shown = receive(
      at("/templates"),
      Message.GotTemplates({ templates: [template] }),
      Message.FailedListRead({ list: "templates" }),
    );
    appScene(shown).expect(Locator.text("Assembly line")).toExist();
  });

  it("blocks Start until the failed list is read again, then restarts the reads", () => {
    const failed = receive(
      at("/start"),
      Message.GotTemplates({ templates: [template] }),
      Message.FailedListRead({ list: "activeSession" }),
    );
    appScene(failed)
      .expect(HtmlLocator.role("button", { name: "Try again" }))
      .toExist();

    const retried = receive(failed, Message.ClickedRetryListRead());
    // A new key restarts the read.
    expect(historyKey(retried)).not.toBe(historyKey(failed));
    appScene(retried)
      .expect(Locator.text("Opening your studies…"))
      .toExist()
      .expect(HtmlLocator.role("button", { name: "Try again" }))
      .toBeAbsent();
    // Lists that were read keep their rows through the retry.
    expect(retried.templates).toEqual(failed.templates);
  });
});
