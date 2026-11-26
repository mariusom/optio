import { UiSchema } from "@effect/ui";
import { Array, Schema, String, pipe } from "effect";

// ROUTE VALUES — tagged schemas, usable as Model fields and Message payloads

export const RouteSchema = UiSchema.TaggedEnum({
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

// PARSE — the URL fragment (hash-driven; offline/GH-Pages friendly) → Route

/**
 * Parse a URL fragment such as `#/history/s-9` into a Route. Empty segments
 * are ignored, IDs keep their encoding, and anything unrecognized lands on Start.
 */
export const parseRoute = (hash: string): Route => {
  const segments = pipe(
    hash,
    String.replace(/^#/, ""),
    String.split("/"),
    Array.filter(String.isNonEmpty),
  );
  const [first, id, ...rest] = segments;
  if (rest.length > 0) return StartTab();
  if (id === undefined) {
    switch (first) {
      case "settings":
        return RouteSchema.SettingsTab();
      case "use-with-ai":
        return RouteSchema.AgentHelp();
      case "about":
        return RouteSchema.About();
      case "history":
        return HistoryTab();
      case "templates":
        return TemplatesTab();
      default:
        return StartTab();
    }
  }
  switch (first) {
    case "session":
      return SessionRunner({ sessionId: id });
    case "templates":
      return TemplateEditor({ templateId: id });
    case "history":
      return SessionDetail({ sessionId: id });
    default:
      return StartTab();
  }
};

// PRINT — Route → href string for anchors and navigation

export const hrefFor = (route: Route): string =>
  `#${RouteSchema.match(route, {
    AgentHelp: () => "/use-with-ai",
    About: () => "/about",
    SettingsTab: () => "/settings",
    HistoryTab: () => "/history",
    TemplatesTab: () => "/templates",
    SessionRunner: ({ sessionId }) => `/session/${sessionId}`,
    TemplateEditor: ({ templateId }) => `/templates/${templateId}`,
    SessionDetail: ({ sessionId }) => `/history/${sessionId}`,
    StartTab: () => "/start",
  })}`;

/** Routes where the bottom tab bar is hidden (full-screen pages). */
export const isFullScreenRoute = (route: Route): boolean =>
  route._tag === "SessionRunner" ||
  route._tag === "TemplateEditor" ||
  route._tag === "SessionDetail";
