// @effect-diagnostics experimentalApiUsage:off -- Effect UI testing is a public preview.
import { Html } from "@effect/ui/html";
import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { Message } from "../messages";
import { storageNotice } from "./storageNotice";

const Notice = Schema.Struct({
  storage: Schema.Literals(["opening", "persisted", "in-memory", "unavailable"]),
  memoryStorageAcknowledged: Schema.Boolean,
  saveStalled: Schema.Boolean,
  backupBusy: Schema.Boolean,
});
type Notice = typeof Notice.Type;

const base: Notice = {
  storage: "persisted",
  memoryStorageAcknowledged: false,
  saveStalled: false,
  backupBusy: false,
};

/** The notice on the runner, passing each message it sends on as an event. */
const Showing = Html.component({
  name: "StorageNotice",
  props: Notice,
  model: Schema.Null,
  message: Message,
  events: Message,
}).make({
  init: () => null,
  update: ($, message) => $.emit(message),
  view: (h) => storageNotice(h.props, h, { recording: true }) ?? h.div,
});

const stalled = Locator.text("hasn’t been able to save");

describe("save stall notice", () => {
  it.effect("warns and offers a backup when saving has stalled", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(Showing, { ...base, saveStalled: true });
      s.expect(Locator.text("hasn’t been able to save your latest changes"))
        .toExist()
        .click(HtmlLocator.role("button", { name: "Download backup" }))
        .emitted(Message.ClickedDownloadBackup());
    }),
  );

  it.effect("stays hidden while a backup or restore is running, and when saving works", () =>
    Effect.gen(function* () {
      const busy = yield* HtmlScene.make(Showing, { ...base, saveStalled: true, backupBusy: true });
      busy.expect(stalled).toBeAbsent();
      const working = yield* HtmlScene.make(Showing, base);
      working.expect(stalled).toBeAbsent();
    }),
  );
});
