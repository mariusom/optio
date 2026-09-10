import { describe, expect, it, vi } from "vitest";
import { Option } from "effect";
import { fromString } from "foldkit/url";

// The LiveStore workers are browser-only (they read `self.name` at module
// scope); the wiring test never opens a store, so stub them out.
vi.mock("@livestore/adapter-web/shared-worker?sharedworker", () => ({
  default: class FakeSharedWorker {},
}));
vi.mock("./livestore/livestore.worker.ts?worker", () => ({
  default: class FakeWorker {},
}));

import { applicationConfig } from "./application.ts";

// Regression guard: the runtime config MUST carry `subscriptions`. Previously
// entry.ts built Runtime.makeApplication without them, so none of the seven
// store→model streams (templates, history, details, active session, runner,
// ticker) ever started — LiveStore wrote and persisted data, but the UI
// showed empty states forever.
describe("application wiring", () => {
  it("includes every app subscription in the runtime configuration", () => {
    expect(applicationConfig.subscriptions).toBeDefined();
    const names = Object.keys(applicationConfig.subscriptions ?? {}).sort();
    expect(names).toEqual(
      [
        "activeSession",
        "agentRequest",
        "currentTaskScroll",
        "editorDraftFocus",
        "focusedSectionScroll",
        "history",
        "historyDetail",
        "runner",
        "templateDetail",
        "templates",
        "ticker",
      ].sort(),
    );
  });

  it("maps hash changes to routes and forwards internal link requests to the navigation guard", () => {
    const url = Option.getOrThrow(fromString("https://optio.test/#/history/session-42"));
    expect(applicationConfig.routing.onUrlChange(url)).toEqual({
      _tag: "GotRoute",
      route: { _tag: "SessionDetail", sessionId: "session-42" },
    });
    const request = { _tag: "Internal" as const, url };
    expect(applicationConfig.routing.onUrlRequest(request)).toEqual({
      _tag: "ClickedLink",
      request,
    });
  });
});
