import { HtmlLocator } from "@effect/ui/html/testing";
import { Locator } from "@effect/ui/testing";
import { it as effectIt } from "@effect/vitest";
import { describe, expect, it, vi } from "vite-plus/test";

import { Message } from "../../../messages";
import { viewScene } from "../viewScene";
import { startView } from "./startView";
import { Effect } from "effect";
import { randomSessionName } from "../../random-name";
import type { TemplateSummary } from "../../types";
import {
  canStart,
  displaySessionName,
  effectiveTemplateId,
  isTemplateMissing,
  resolveSelectedTemplate,
  resolveTemplateByIdOrName,
} from "./startHelpers";

const t = (overrides: Partial<TemplateSummary> & { id: string }): TemplateSummary => ({
  name: "Template",
  isDefault: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  fieldCount: 1,
  requiredCount: 0,
  ...overrides,
});

describe("Foldcn session launcher", () => {
  const model: Parameters<typeof startView>[0] = {
    templates: [t({ id: "a", name: "Assembly" }), t({ id: "b", name: "Patient care" })],
    selectedTemplateId: "a",
    sessionNameInput: "",
    placeholderName: "Morning shift",
    activeSession: null,
    pendingDiscardSession: false,
    now: 1_700_000_000_000,
  };
  type StartModel = Parameters<typeof startView>[0];
  const showing = (current: StartModel) => viewScene((h) => startView(current, h));
  const select = HtmlLocator.role("combobox", { name: "Study template" });
  const start = HtmlLocator.role("button", { name: "Start Session" });

  effectIt.effect("announces persistence errors even before templates have loaded", () =>
    Effect.gen(function* () {
      const s = yield* showing({ ...model, templates: [], lastError: "Store unavailable" });
      s.expect(HtmlLocator.role("alert"))
        .toExist()
        .expect(Locator.text("Store unavailable"))
        .toExist();
    }),
  );

  effectIt.effect("labels the native select and emits the selected template", () =>
    Effect.gen(function* () {
      const s = yield* showing(model);
      s.expect(select)
        .toHaveValue("a")
        .change(select, "b")
        .emitted(Message.SelectedTemplate({ id: "b" }));
    }),
  );

  effectIt.effect("dispatches start through the Foldcn button", () =>
    Effect.gen(function* () {
      const s = yield* showing(model);
      s.click(start).emitted(Message.ClickedStartSession());
    }),
  );

  effectIt.effect("disables starting without a selected template", () =>
    Effect.gen(function* () {
      const s = yield* showing({ ...model, selectedTemplateId: null });
      s.expect(start).toBeDisabled();
    }),
  );

  effectIt.effect("shows elapsed time from the Model's ticked now, not the wall clock", () =>
    Effect.gen(function* () {
      const s = yield* showing({
        ...model,
        activeSession: {
          id: "session-1",
          templateId: "a",
          templateName: "Assembly",
          sessionName: "Study",
          startedAt: 1_000,
          completedCount: 2,
        },
        now: 1_000 + 90 * 60_000,
      });
      s.expect(Locator.text("1h 30m")).toExist();
    }),
  );
});

describe("randomSessionName", () => {
  it("draws adjective and noun independently, including both ends of each list", () => {
    const random = vi.spyOn(Math, "random");
    try {
      random.mockReturnValueOnce(0).mockReturnValueOnce(0.999999);
      expect(Effect.runSync(randomSessionName)).toBe("Amber Topaz");
      random.mockReturnValueOnce(0.999999).mockReturnValueOnce(0);
      expect(Effect.runSync(randomSessionName)).toBe("Winding Canyon");
    } finally {
      random.mockRestore();
    }
  });
});

describe("resolveSelectedTemplate", () => {
  it("returns null when selected is null", () => {
    expect(resolveSelectedTemplate([t({ id: "a" })], null)).toBeNull();
  });
  it("returns matching template by id", () => {
    const templates = [t({ id: "a", name: "A" }), t({ id: "b", name: "B" })];
    expect(resolveSelectedTemplate(templates, "b")?.name).toBe("B");
  });
  it("returns null when id not found", () => {
    expect(resolveSelectedTemplate([t({ id: "a" })], "missing")).toBeNull();
  });
});

describe("resolveTemplateByIdOrName fallback", () => {
  it("prefers id when present", () => {
    const templates = [t({ id: "a", name: "Alpha" }), t({ id: "b", name: "Beta" })];
    expect(resolveTemplateByIdOrName(templates, "b", "Alpha")?.id).toBe("b");
  });
  it("falls back to name when id not found", () => {
    const templates = [t({ id: "a", name: "Alpha" }), t({ id: "b", name: "Beta" })];
    expect(resolveTemplateByIdOrName(templates, "missing", "Beta")?.id).toBe("b");
  });
  it("falls back to name when id null", () => {
    const templates = [t({ id: "a", name: "Alpha" })];
    expect(resolveTemplateByIdOrName(templates, null, "Alpha")?.id).toBe("a");
  });
  it("returns null when neither matches", () => {
    expect(
      resolveTemplateByIdOrName([t({ id: "a", name: "Alpha" })], "missing", "MissingName"),
    ).toBeNull();
  });
});

describe("effectiveTemplateId", () => {
  it("returns null when no templates", () => {
    expect(effectiveTemplateId([], null)).toBeNull();
  });
  it("returns selected when it exists", () => {
    const templates = [t({ id: "a" }), t({ id: "b" })];
    expect(effectiveTemplateId(templates, "b")).toBe("b");
  });
  it("falls back to default when selected null", () => {
    const templates = [
      t({ id: "a", isDefault: false, name: "A" }),
      t({ id: "b", isDefault: true, name: "B" }),
    ];
    expect(effectiveTemplateId(templates, null)).toBe("b");
  });
  it("falls back to first when no default and selected missing", () => {
    const templates = [t({ id: "a", name: "A" }), t({ id: "b", name: "B" })];
    expect(effectiveTemplateId(templates, "missing")).toBe("a");
  });
});

describe("canStart", () => {
  it("false when no templates", () => {
    expect(canStart([], null)).toBe(false);
  });
  it("false when no selected", () => {
    expect(canStart([t({ id: "a" })], null)).toBe(false);
  });
  it("false when selected not in list", () => {
    expect(canStart([t({ id: "a" })], "missing")).toBe(false);
  });
  it("true when selected exists", () => {
    expect(canStart([t({ id: "a" })], "a")).toBe(true);
  });
});

describe("displaySessionName", () => {
  it("returns sessionName when non-empty", () => {
    expect(displaySessionName("My session", "Template")).toBe("My session");
  });
  it("falls back to templateName when session empty", () => {
    expect(displaySessionName("", "Template")).toBe("Template");
  });
});

describe("isTemplateMissing", () => {
  it("false when active is null", () => {
    expect(isTemplateMissing([t({ id: "a", name: "Alpha" })], null)).toBe(false);
  });
  it("false when template exists by id", () => {
    const tmpls = [t({ id: "a", name: "Alpha" })];
    expect(
      isTemplateMissing(tmpls, {
        id: "s1",
        templateId: "a",
        templateName: "Alpha",
        sessionName: "",
        startedAt: Date.now(),
        completedCount: 0,
      }),
    ).toBe(false);
  });
  it("true when template id present but missing", () => {
    expect(
      isTemplateMissing([t({ id: "a", name: "Alpha" })], {
        id: "s1",
        templateId: "missing",
        templateName: "Ghost",
        sessionName: "",
        startedAt: Date.now(),
        completedCount: 0,
      }),
    ).toBe(true);
  });
  it("false when id missing but name matches", () => {
    const tmpls = [t({ id: "b", name: "Ghost" })];
    expect(
      isTemplateMissing(tmpls, {
        id: "s1",
        templateId: "missing",
        templateName: "Ghost",
        sessionName: "",
        startedAt: Date.now(),
        completedCount: 0,
      }),
    ).toBe(false);
  });
});
