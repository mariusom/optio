import { Effect, Option, pipe, Schema as S } from "effect";
import { defineRouteUnion, literal, mapTo, oneOf, slash, string } from "foldkit/route";
import type { Url } from "foldkit/url";

// ROUTE VALUES — tagged schemas, usable as Model fields and Message payloads

export const RouteSchema = defineRouteUnion({
  StartTab: {},
  HistoryTab: {},
  TemplatesTab: {},
  SessionRunner: { sessionId: S.String },
  TemplateEditor: { templateId: S.String },
  SessionDetail: { sessionId: S.String },
});

export const { StartTab, HistoryTab, TemplatesTab, SessionRunner, TemplateEditor, SessionDetail } =
  RouteSchema;

export type Route = typeof RouteSchema.Type;

// ROUTERS — bidirectional: parse URL segments AND build href strings

const startRouter = mapTo(StartTab)(literal("start"));
export const historyRouter = mapTo(HistoryTab)(literal("history"));
export const templatesRouter = mapTo(TemplatesTab)(literal("templates"));
export const sessionRunnerRouter = pipe(
  literal("session"),
  slash(string("sessionId")),
  mapTo(SessionRunner),
);
export const templateEditorRouter = pipe(
  literal("templates"),
  slash(string("templateId")),
  mapTo(TemplateEditor),
);
export const sessionDetailRouter = pipe(
  literal("history"),
  slash(string("sessionId")),
  mapTo(SessionDetail),
);

const router = oneOf(
  startRouter,
  historyRouter,
  templatesRouter,
  sessionRunnerRouter,
  templateEditorRouter,
  sessionDetailRouter,
);

// PARSE — Url (hash-driven; offline/GH-Pages friendly) → Route

const segmentsFromHash = (hash: Option.Option<string>): ReadonlyArray<string> =>
  Option.getOrElse(hash, () => "")
    .replace(/^#/, "")
    .split("/")
    .filter((segment) => segment !== "");

/** Parse a foldkit Url into a Route; anything unrecognized lands on Start. */
export const parseRoute = (url: Url): Route =>
  pipe(
    router.parse(segmentsFromHash(url.hash)),
    Effect.match({
      onFailure: () => StartTab(),
      onSuccess: ([route]) => route,
    }),
    Effect.runSync,
  );

// PRINT — Route → href string for anchors

export const hrefFor = (route: Route): string => {
  switch (route._tag) {
    case "HistoryTab":
      return `#${historyRouter()}`;
    case "TemplatesTab":
      return `#${templatesRouter()}`;
    case "SessionRunner":
      return `#${sessionRunnerRouter({ sessionId: route.sessionId })}`;
    case "TemplateEditor":
      return `#${templateEditorRouter({ templateId: route.templateId })}`;
    case "SessionDetail":
      return `#${sessionDetailRouter({ sessionId: route.sessionId })}`;
    case "StartTab":
      return `#${startRouter()}`;
  }
};

/** Routes where the bottom tab bar is hidden (full-screen pages). */
export const isFullScreenRoute = (route: Route): boolean =>
  route._tag === "SessionRunner" ||
  route._tag === "TemplateEditor" ||
  route._tag === "SessionDetail";
