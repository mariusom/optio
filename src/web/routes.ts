import { Option, pipe, Schema } from "effect";
import {
  defineRouteUnion,
  literal,
  mapTo,
  oneOf,
  parseUrlWithFallback,
  slash,
  string,
} from "foldkit/route";
import type { Url } from "foldkit/url";

// ROUTE VALUES — tagged schemas, usable as Model fields and Message payloads

export const RouteSchema = defineRouteUnion({
  StartTab: {},
  HistoryTab: {},
  TemplatesTab: {},
  SettingsTab: {},
  AgentHelp: {},
  About: {},
  SessionRunner: { sessionId: Schema.String },
  TemplateEditor: { templateId: Schema.String },
  SessionDetail: { sessionId: Schema.String },
});

export const { StartTab, HistoryTab, TemplatesTab, SessionRunner, TemplateEditor, SessionDetail } =
  RouteSchema;

export type Route = typeof RouteSchema.Type;

// ROUTERS — bidirectional: parse URL segments AND build href strings

const startRouter = mapTo(StartTab)(literal("start"));
const settingsRouter = mapTo(RouteSchema.SettingsTab)(literal("settings"));
const agentHelpRouter = mapTo(RouteSchema.AgentHelp)(literal("use-with-ai"));
const aboutRouter = mapTo(RouteSchema.About)(literal("about"));
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
  settingsRouter,
  agentHelpRouter,
  aboutRouter,
  startRouter,
  historyRouter,
  templatesRouter,
  sessionRunnerRouter,
  templateEditorRouter,
  sessionDetailRouter,
);

// PARSE — Url (hash-driven; offline/GH-Pages friendly) → Route

const parsePath = parseUrlWithFallback(router, { make: () => StartTab() });

/** Parse a foldkit Url into a Route; anything unrecognized lands on Start. */
export const parseRoute = (url: Url): Route =>
  parsePath({
    ...url,
    pathname: Option.getOrElse(url.hash, () => "").replace(/^#/, ""),
    search: Option.none(),
  });

// PRINT — Route → href string for anchors

export const hrefFor = (route: Route): string =>
  `#${RouteSchema.match(route, {
    AgentHelp: () => agentHelpRouter(),
    About: () => aboutRouter(),
    SettingsTab: () => settingsRouter(),
    HistoryTab: () => historyRouter(),
    TemplatesTab: () => templatesRouter(),
    SessionRunner: ({ sessionId }) => sessionRunnerRouter({ sessionId }),
    TemplateEditor: ({ templateId }) => templateEditorRouter({ templateId }),
    SessionDetail: ({ sessionId }) => sessionDetailRouter({ sessionId }),
    StartTab: () => startRouter(),
  })}`;

/** Routes where the bottom tab bar is hidden (full-screen pages). */
export const isFullScreenRoute = (route: Route): boolean =>
  route._tag === "SessionRunner" ||
  route._tag === "TemplateEditor" ||
  route._tag === "SessionDetail";
