import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";

import { initWithFlags, update } from "../main";
import { Message } from "../messages";

const booted = initWithFlags(
  {
    theme: "auto",
    style: "nova",
    font: "sans",
    iconLibrary: "hugeicons",
    accent: "default",
    now: 0,
    idSeed: "boot",
  },
  Option.getOrThrow(fromString("https://optio.test/#/templates")),
).model;

describe("IDs created in update", () => {
  it("come from the boot seed, are unique, and repeat for the same input", () => {
    const opened = update(booted, Message.ClickedNewTemplate()).model;
    const drafting = update(opened, Message.ClickedAddField()).model;
    const templateId = opened.editor!.id;
    const draftId = drafting.editor!.draft!.id;

    expect(templateId).toBe("boot-0");
    expect(draftId).toBe("boot-1");
    // Update reads no random source: replaying the Message gives the same IDs.
    expect(update(booted, Message.ClickedNewTemplate()).model.editor!.id).toBe(templateId);
  });
});
