import { describe, expect, it } from "vite-plus/test";

import {
  hrefFor,
  parseRoute,
  RouteSchema,
  HistoryTab,
  SessionDetail,
  SessionRunner,
  StartTab,
  TemplateEditor,
  TemplatesTab,
} from "./routes";
describe("parseRoute", () => {
  it("lands unknown or empty hashes on the Start tab", () => {
    expect(parseRoute("")).toEqual(StartTab());
    expect(parseRoute("")).toEqual(StartTab());
    expect(parseRoute("#/")).toEqual(StartTab());
    expect(parseRoute("#/nonsense")).toEqual(StartTab());
  });

  it("parses tab routes", () => {
    expect(parseRoute("#/start")._tag).toBe("StartTab");
    expect(parseRoute("#/history")._tag).toBe("HistoryTab");
    expect(parseRoute("#/templates")._tag).toBe("TemplatesTab");
  });

  it("parses parameterized routes", () => {
    expect(parseRoute("#/session/abc-123")).toEqual(SessionRunner({ sessionId: "abc-123" }));
    expect(parseRoute("#/templates/t-42")).toEqual(TemplateEditor({ templateId: "t-42" }));
    expect(parseRoute("#/history/s-9")).toEqual(SessionDetail({ sessionId: "s-9" }));
  });

  it("requires complete paths but ignores empty segments and preserves encoded IDs", () => {
    expect(parseRoute("#/session")).toEqual(StartTab());
    expect(parseRoute("#/history/s-9/extra")).toEqual(StartTab());
    expect(parseRoute("#//templates///t%2F42/")).toEqual(TemplateEditor({ templateId: "t%2F42" }));
  });
});

describe("hrefFor round-trips through parseRoute", () => {
  const routes = [
    StartTab(),
    HistoryTab(),
    TemplatesTab(),
    RouteSchema.SettingsTab(),
    RouteSchema.AgentHelp(),
    RouteSchema.About(),
    SessionRunner({ sessionId: "x1" }),
    TemplateEditor({ templateId: "t1" }),
    SessionDetail({ sessionId: "s1" }),
  ];

  for (const route of routes) {
    it(`round-trips ${route._tag}`, () => {
      const href = hrefFor(route);
      expect(href.startsWith("#")).toBe(true);
      expect(parseRoute(href)).toEqual(route);
    });
  }

  it("builds distinct hrefs for tabs", () => {
    const hrefs = routes.slice(0, 3).map(hrefFor);
    expect(new Set(hrefs).size).toBe(3);
    expect(hrefFor(HistoryTab())).toBe("#/history");
  });
});
