import { Runtime } from "foldkit";
import type { Url } from "foldkit/url";
import { registerSW } from "virtual:pwa-register";

import "./index.css";
import { Message } from "./messages.ts";
import { parseRoute } from "./we/routes.ts";
import { Model, init, update, view } from "./main.ts";

// ── PWA update toast ─────────────────────────────────────────────────────────
// Design system §5.9: never reload the page out from under the user. When a new
// service worker takes control (or is `waiting`, prompt-style), show an
// unobtrusive toast; the user taps it to apply the update — no mid-session
// surprise reloads while recording a study.
// Built imperatively (no framework churn) with the `pwa-update-toast` id so it
// can never be duplicated.

const TOAST_ID = "pwa-update-toast";
const TOAST_CLASS =
  "fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-box border border-base-300 bg-base-100/90 px-4 py-3 text-sm font-medium text-base-content shadow-lg backdrop-blur-md animate-[toast-in_0.25s_ease-out]";

const showUpdateToast = (onTap: () => void) => {
  if (document.getElementById(TOAST_ID) !== null) return;
  const toast = document.createElement("button");
  toast.id = TOAST_ID;
  toast.type = "button";
  toast.className = TOAST_CLASS;
  toast.setAttribute("role", "status");
  toast.textContent = "Update available — tap to refresh";
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
  Model,
  init,
  update,
  view,
  routing: {
    // foldkit preventDefaults same-origin anchor clicks and hands us the
    // request; history is written by our NavigateInternal/NavigateExternal
    // Commands (pushUrl/load), which come back here as onUrlChange.
    onUrlRequest: (request) => Message.ClickedLink({ request }),
    onUrlChange: (url: Url) => Message.GotRoute({ route: parseRoute(url) }),
  },
  container: document.getElementById("root")!,
});

Runtime.run(application);
