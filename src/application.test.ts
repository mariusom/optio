import { describe, expect, it, vi } from "vitest";

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
  it("passes subscriptions to the runtime (store streams actually start)", () => {
    expect(applicationConfig.subscriptions).toBeDefined();
    const names = Object.keys(applicationConfig.subscriptions ?? {}).sort();
    expect(names).toEqual(
      [
        "activeSession",
        "currentTaskScroll",
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

  it("still wires the hash-router callbacks", () => {
    expect(applicationConfig.routing.onUrlChange).toBeTypeOf("function");
    expect(applicationConfig.routing.onUrlRequest).toBeTypeOf("function");
  });
});
