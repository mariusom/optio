import { afterEach, expect, it, vi } from "vitest";
import { schema } from "./schema";

afterEach(() => vi.useRealTimers());

const sql = (result: unknown): unknown =>
  Array.isArray(result) ? result.map(sql) : (result as { asSql: () => unknown }).asSql();

it.each([
  ["TemplateCreated", { id: "t", name: "Study", isDefault: false }],
  ["TemplateUpdated", { id: "t", name: "Edited", isDefault: true, fields: [] }],
  ["TemplatesSeeded", { templates: [{ id: "seed", name: "Sample", isDefault: true, fields: [] }] }],
  ["SessionStarted", { id: "s", templateId: "t", templateName: "Study", sessionName: "Round" }],
])("keeps %s deterministic and uses the v3 event's timestamp", (name, payload) => {
  vi.useFakeTimers();
  const materialize = schema.state.materializers.get(`v3.${name}`)!;
  const now = new Date("2026-03-04T09:12:34Z");
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  const before = sql(materialize({ ...payload, now }, {} as never));
  vi.setSystemTime(new Date("2026-09-01T18:00:00Z"));
  expect(sql(materialize({ ...payload, now }, {} as never))).toEqual(before);
  expect(JSON.stringify(before)).toContain("1772615554000");
  expect(JSON.stringify(before)).not.toContain(String(Date.now()));
});

it("replays stable archive identities, including duplicate section names", () => {
  const materialize = schema.state.materializers.get("v2.SessionEnded")!;
  const section = {
    sectionName: "Note",
    value: "A",
    sectionType: "textInput",
    isRequired: false,
    startedAt: null,
  };
  const payload = {
    id: "s",
    endedAt: new Date(4000),
    records: [
      {
        taskIdNumber: 2,
        taskType: "single",
        startedAt: new Date(1000),
        endedAt: new Date(3000),
        sections: [section, { ...section, value: "B" }],
      },
    ],
  };
  const context = { query: () => [{ count: 1 }] } as never;
  const first = sql(materialize(payload, context));
  expect(sql(materialize(payload, context))).toEqual(first);
  expect(JSON.stringify(first)).toContain("s:2:0");
  expect(JSON.stringify(first)).toContain("s:2:1");
});
