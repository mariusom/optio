import type { Html } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, it } from "vite-plus/test";

import { Message } from "../messages";
import { storageNotice } from "./storageNotice";

type Notice = Parameters<typeof storageNotice>[0];
const base: Notice = {
  storage: "persisted",
  memoryStorageAcknowledged: false,
  saveStalled: false,
  backupBusy: false,
};

const showing = (
  model: Notice,
  ...steps: ReadonlyArray<Scene.SceneStep<Notice, Message, Message>>
) =>
  Scene.scene(
    {
      update: (current: Notice, message: Message) => ({ model: current, outMessage: message }),
      view: (current: Notice, h) =>
        (storageNotice(current, h, { recording: true }) ?? h.div([])) as Html,
    },
    Scene.given(model),
    ...steps,
  );

describe("save stall notice", () => {
  it("warns and offers a backup when saving has stalled", () =>
    showing(
      { ...base, saveStalled: true },
      Scene.expect(Scene.text(/hasn’t been able to save your latest changes/)).toExist(),
      Scene.click(Scene.role("button", { name: "Download backup" })),
      Scene.expectOutMessage(Message.ClickedDownloadBackup()),
    ));

  it("stays hidden while a backup or restore is running, and when saving works", () => {
    showing(
      { ...base, saveStalled: true, backupBusy: true },
      Scene.expect(Scene.text(/hasn’t been able to save/)).toBeAbsent(),
    );
    showing(base, Scene.expect(Scene.text(/hasn’t been able to save/)).toBeAbsent());
  });
});
