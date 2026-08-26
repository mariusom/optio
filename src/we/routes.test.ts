import { Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  historyRouter,
  hrefFor,
  parseRoute,
  HistoryTab,
  SessionDetail,
  SessionRunner,
  StartTab,
  TemplateEditor,
  TemplatesTab,
} from "./routes";
import type { Url } from "foldkit/url";

const urlWithHash = (hash: string | null): Url => ({
  protocol: "https:",
  host: "example.com",
  port: Option.none(),
  pathname: "/optio/",
  search: Option.none(),
  hash: hash === null ? Option.none() : Option.some(hash),
});

describe("parseRoute", () => {
  it("lands unknown or empty hashes on the Start tab", () => {
    expect(parseRoute(urlWithHash(null))).toEqual(StartTab());
    expect(parseRoute(urlWithHash(""))).toEqual(StartTab());
    expect(parseRoute(urlWithHash("#/"))).toEqual(StartTab());
    expect(parseRoute(urlWithHash("#/nonsense"))).toEqual(StartTab());
  });

  it("parses tab routes", () => {
    expect(parseRoute(urlWithHash("#/start"))._tag).toBe("StartTab");
    expect(parseRoute(urlWithHash("#/history"))._tag).toBe("HistoryTab");
    expect(parseRoute(urlWithHash("#/templates"))._tag).toBe("TemplatesTab");
  });

  it("parses parameterized routes", () => {
    expect(parseRoute(urlWithHash("#/session/abc-123"))).toEqual(
      SessionRunner({ sessionId: "abc-123" }),
    );
    expect(parseRoute(urlWithHash("#/templates/t-42"))).toEqual(
      TemplateEditor({ templateId: "t-42" }),
    );
    expect(parseRoute(urlWithHash("#/history/s-9"))).toEqual(SessionDetail({ sessionId: "s-9" }));
  });
});

describe("hrefFor round-trips through parseRoute", () => {
  const routes = [
    StartTab(),
    HistoryTab(),
    TemplatesTab(),
    SessionRunner({ sessionId: "x1" }),
    TemplateEditor({ templateId: "t1" }),
    SessionDetail({ sessionId: "s1" }),
  ];

  for (const route of routes) {
    it(`round-trips ${route._tag}`, () => {
      const href = hrefFor(route);
      expect(href.startsWith("#")).toBe(true);
      const url = urlWithHash(href);
      expect(parseRoute(url)).toEqual(route);
    });
  }

  it("builds distinct hrefs for tabs", () => {
    const hrefs = routes.slice(0, 3).map(hrefFor);
    expect(new Set(hrefs).size).toBe(3);
    expect(historyRouter()).toBe("/history");
  });
});
