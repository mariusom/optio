import { BrowserHost } from "@effect/ui/html";
import { DevTools } from "@effect/ui-devtools";
import { Clock, Effect, Fiber, Layer } from "effect";
import * as BrowserRuntime from "@effect/platform-browser/BrowserRuntime";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import { App, devToolsOptions } from "./application.ts";
import { CurrentAgentBridge, makeAgentBridge } from "./agents/bridge";
import {
  initializeAccent,
  initializeControlSize,
  initializeFont,
  initializeIconLibrary,
  initializeLook,
  initializeStyle,
  initializeTheme,
} from "./web/browserTheme";
import { getStore } from "./store/client";
import { randomUuid } from "./lib/ids";
import type { ModelContext } from "./agents/webmcp";
import { signalUpdateReady } from "./web/updateSignal";

// Register the service worker first, independent of the app: even a release
// that fails to boot still installs offline support and receives the fix. The
// app shows "Update ready" and reloads only when tapped (web/appUpdate.ts).
registerSW({ immediate: true, onNeedReload: signalUpdateReady });

// Startup Flags: saved preferences (applied to the document as they load) and
// the Model's first time, from Effect's Clock, never Date.now(), and the
// random seed for IDs created in update.
const browserFlags = Effect.all(
  {
    theme: initializeTheme,
    style: initializeStyle,
    font: initializeFont,
    iconLibrary: initializeIconLibrary,
    accent: initializeAccent,
    look: initializeLook,
    controlSize: initializeControlSize,
    now: Clock.currentTimeMillis,
    idSeed: randomUuid,
  },
  // In order: each initializer applies its preference to the document.
  { concurrency: 1 },
);

const main = Effect.gen(function* () {
  // Explicit per-tab opt-in grants access to study values and all existing UI operations.
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
  const url = new URL(location.href);
  const supported = typeof modelContext?.registerTool === "function";
  const requested = supported && url.searchParams.get("agentTools") === "1";
  const approved =
    requested &&
    window.confirm(
      "Let an assistant use Optio in this tab? It will be able to read, change and delete your studies, and may send them to its provider. Cancel to keep assistants off.",
    );
  if (requested && !approved) {
    // A retry must load a new document, not just change the fragment.
    url.searchParams.delete("agentTools");
    history.replaceState(history.state, "", url);
  }
  const assistantAccess = approved ? "approved" : supported ? "off" : "unavailable";
  const flags = Effect.map(browserFlags, (values) => ({ ...values, assistantAccess }) as const);
  // One bridge per mounted app: the app's Subscription reads its requests and
  // ReplyToAgent answers through it; the agent connection holds its handles.
  const bridge = makeAgentBridge();

  const register = (context: ModelContext) =>
    Effect.gen(function* () {
      const [{ registerWebMcp }, { makeToolHandlers }, { connectAgentApplication }] =
        yield* Effect.all(
          [
            Effect.promise(() => import("./agents/webmcp")),
            Effect.promise(() => import("./agents/tools")),
            Effect.promise(() => import("./agents/connection")),
          ],
          { concurrency: "unbounded" },
        );
      const connection = connectAgentApplication(bridge.handles, (message) =>
        window.confirm(message),
      );
      yield* registerWebMcp(context, makeToolHandlers(getStore, connection));
      return yield* Effect.never;
    }).pipe(
      Effect.scoped,
      Effect.catchCause(() =>
        Effect.logWarning("Optio agent tools could not be registered. The app remains available."),
      ),
    );

  const app = BrowserHost.mount(App, flags, document.getElementById("root")!).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(CurrentAgentBridge, bridge),
        // Optio registers its own WebMCP tools; keep the inspector's off the page.
        import.meta.env.DEV ? DevTools.layer({ ...devToolsOptions, webMcp: false }) : Layer.empty,
      ),
    ),
  );

  // Only a supported context can be approved.
  const program =
    approved && modelContext !== undefined
      ? Effect.all([Layer.launch(app), register(modelContext)], {
          concurrency: "unbounded",
          discard: true,
        })
      : Layer.launch(app);
  const fiber = yield* Effect.forkDetach(program);
  // HMR dispose is a synchronous callback outside this fiber: run the
  // interruption with the main program's services.
  const context = yield* Effect.context();
  const runFork = Effect.runForkWith(context);
  import.meta.hot?.dispose(() => {
    runFork(Fiber.interrupt(fiber));
  });
  return yield* Fiber.join(fiber);
});

BrowserRuntime.runMain(main);
