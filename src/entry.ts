// fallow-ignore-file unused-file — app entry (referenced by index.html, not by other modules)
import { Runtime } from "foldkit";
import { Effect, Fiber } from "effect";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import { applicationConfig } from "./application.ts";
import { initializeTheme } from "./we/browserTheme";
import { installSheetFocus } from "./we/sheetFocus";
import { getStore } from "./livestore/client";
import type { ModelContext } from "./agents/webmcp";

const theme = initializeTheme();
installSheetFocus();

// ── PWA update toast ─────────────────────────────────────────────────────────
// Design system §5.9: never reload the page out from under the user. When a new
// service worker takes control (or is `waiting`, prompt-style), show an
// unobtrusive toast; the user taps it to apply the update — no mid-session
// surprise reloads while recording a study.
// Built imperatively (no framework churn) with the `pwa-update-toast` id so it
// can never be duplicated.

const TOAST_ID = "pwa-update-toast";
const TOAST_CLASS =
  "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg animate-[toast-in_0.25s_ease-out]";

const showUpdateToast = (onTap: () => void) => {
  if (document.getElementById(TOAST_ID) !== null) return;
  const toast = document.createElement("button");
  toast.id = TOAST_ID;
  toast.type = "button";
  toast.className = TOAST_CLASS;
  toast.setAttribute("role", "status");
  toast.textContent = "Update ready. Tap to refresh.";
  toast.addEventListener("click", () => {
    // Guard against double taps firing the reload twice.
    toast.disabled = true;
    toast.textContent = "Loading update…";
    onTap();
  });
  document.body.appendChild(toast);
};

const updateSW = registerSW({
  immediate: true,
  // autoUpdate mode: the plugin fires this once the new SW has taken control —
  // exactly where it would otherwise reload the page immediately. Deferring to
  // an explicit tap is the Safari-friendly "Update available" flow.
  onNeedReload() {
    showUpdateToast(() => window.location.reload());
  },
  // Prompt-style hook (used when registerType is "prompt"): updateSW(true)
  // posts SKIP_WAITING to the waiting registration and reloads on confirm.
  onNeedRefresh() {
    showUpdateToast(() => void updateSW(true));
  },
});

const application = Runtime.makeApplication({
  ...applicationConfig,
  init: (url) => {
    const initial = applicationConfig.init(url);
    return { ...initial, model: { ...initial.model, theme } };
  },
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
  const handle = Runtime.embed(application);
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
    const connection = connectAgentApplication(handle.ports, (message) => window.confirm(message));
    yield* registerWebMcp(modelContext, makeToolHandlers(getStore, connection));
    yield* Effect.never;
  }).pipe(
    Effect.scoped,
    Effect.catchCause(() =>
      Effect.logWarning("Optio agent tools could not be registered. The app remains available."),
    ),
  );
  const fiber = Effect.runFork(registration);
  import.meta.hot?.dispose(() => {
    Effect.runFork(Fiber.interrupt(fiber));
    handle.dispose();
  });
} else {
  Runtime.run(application);
}
