import { describe, expect, it } from "vitest";

import { generateSessionName } from "../../random-name";
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

describe("generateSessionName", () => {
  it("returns two words with a space", () => {
    const name = generateSessionName();
    expect(name).toMatch(/^[A-Za-z]+ [A-Za-z]+$/);
    const parts = name.split(" ");
    expect(parts).toHaveLength(2);
    expect(parts[0]!.length).toBeGreaterThan(0);
    expect(parts[1]!.length).toBeGreaterThan(0);
  });

  it("produces varying names on repeated calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 20; i++) set.add(generateSessionName());
    // With 96*109 combos, 20 draws should produce >1 distinct value
    expect(set.size).toBeGreaterThan(1);
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
  it("true when fallback by name also fails", () => {
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
