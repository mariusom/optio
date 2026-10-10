import { Runtime } from "foldkit";
import { Clock, Effect, Fiber } from "effect";
import * as BrowserRuntime from "@effect/platform-browser/BrowserRuntime";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import { applicationConfig } from "./application.ts";
import {
  initializeAccent,
  initializeControlSize,
  initializeFont,
  initializeIconLibrary,
  initializeLook,
  initializeStyle,
  initializeTheme,
} from "./web/browserTheme";
import { getStore } from "./livestore/client";
import type { ModelContext } from "./agents/webmcp";
import { signalUpdateReady } from "./web/updateSignal";

// Register the service worker first, independent of the app: even a release
// that fails to boot still installs offline support and receives the fix. The
// app shows "Update ready" and reloads only when tapped (web/appUpdate.ts).
registerSW({ immediate: true, onNeedReload: signalUpdateReady });

// Startup Flags: saved preferences (applied to the document as they load) and
// the Model's first time, from Effect's Clock, never Date.now(), and the
// random seed for IDs created in update.
const flags = Effect.all({
  theme: initializeTheme,
  style: initializeStyle,
  font: initializeFont,
  iconLibrary: initializeIconLibrary,
  accent: initializeAccent,
  look: initializeLook,
  controlSize: initializeControlSize,
  now: Clock.currentTimeMillis,
  idSeed: Effect.sync(() => crypto.randomUUID()),
});

const main = Effect.gen(function* () {
  const application = Runtime.makeApplication({
    ...applicationConfig,
    container: document.getElementById("root")!,
  });

  // Explicit per-tab opt-in grants access to study values and all existing UI operations.
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (
    new URLSearchParams(location.search).get("agentTools") === "1" &&
    modelContext &&
    window.confirm(
      "Let an assistant use Optio in this tab? It will be able to read, change and delete your studies, and may send them to its provider. Cancel to keep assistants off.",
    )
  ) {
    const handle = Runtime.embed(application, { flags });
    const registration = Effect.gen(function* () {
      const [{ registerWebMcp }, { makeToolHandlers }, { connectAgentApplication }] =
        yield* Effect.all(
          [
            Effect.promise(() => import("./agents/webmcp")),
            Effect.promise(() => import("./agents/tools")),
            Effect.promise(() => import("./agents/connection")),
          ],
          { concurrency: "unbounded" },
        );
      const connection = connectAgentApplication(handle.ports, (message) =>
        window.confirm(message),
      );
      yield* registerWebMcp(modelContext, makeToolHandlers(getStore, connection));
      yield* Effect.never;
    }).pipe(
      Effect.scoped,
      Effect.catchCause(() =>
        Effect.logWarning("Optio agent tools could not be registered. The app remains available."),
      ),
    );
    // Forked from the main program so the registration shares its runtime.
    const fiber = yield* Effect.forkDetach(registration);
    import.meta.hot?.dispose(() => {
      Effect.runFork(Fiber.interrupt(fiber));
      handle.dispose();
    });
  } else {
    Runtime.run(application, { flags });
  }
});

BrowserRuntime.runMain(main);
