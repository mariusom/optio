import { Subscription } from "@effect/ui";
import { Cause, Clock, Duration, Effect, Option, Stream, String, pipe } from "effect";
import { CurrentAgentBridge } from "../agents/bridge";
import { fromEvent, fromEventPreventingDefault, fromMediaQuery } from "@/lib/domEvents";
import { parseRoute } from "../web/routes";
import { Message } from "../messages";
import { activeSessionOf, type Model, type StoreList } from "./model";
import { historyDetailStream, historyStream } from "./historyStreams";
import { activeSessionStream, runnerStream } from "./sessionStreams";
import { storageStatusStream } from "./storageStreams";
import { appUpdates } from "../web/appUpdate";
import { templateDetailStream, templateReportStream, templatesStream } from "./templateStreams";
import {
  focusEditorDraft,
  focusHelpPage,
  scrollToCurrentTask,
  scrollToSection,
} from "./domStreams";
import { saveStallStream } from "./saveStallStreams";
import { primaryShortcutPresses } from "../web/features/session/runnerShortcuts";

const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

/** Emits the current visibility, then each change, so hidden tabs can pause work. */
const documentVisibility: Stream.Stream<boolean> =
  typeof document === "undefined"
    ? Stream.succeed(true)
    : Stream.concat(
        Stream.suspend(() => Stream.succeed(isDocumentVisible())),
        fromEvent(document, "visibilitychange", isDocumentVisible),
      ).pipe(Stream.changes);

// Reads the time through Effect's Clock, so a test runtime can supply it, and
// the Model carries the value; views never read the clock themselves. Ticks
// pause while the tab is hidden; `Stream.tick` emits at once, so returning to
// the tab refreshes the time immediately.
const tickStream = (interval: Duration.Duration): Stream.Stream<Message> =>
  documentVisibility.pipe(
    Stream.switchMap((visible) => (visible ? Stream.tick(interval) : Stream.empty)),
    Stream.mapEffect(() => Clock.currentTimeMillis),
    Stream.map((now) => Message.Ticked({ now })),
  );

/** Idle time after the last keystroke before typed answers are written. */
const FIELD_WRITE_DELAY = Duration.millis(500);

/**
 * The page may be discarded after these, so pending answers are written at
 * once. `beforeunload` starts the flush when reload or navigation begins,
 * but the browser may discard the page before the asynchronous write finishes.
 * The listener exists only while answers are pending.
 */
const pageLeaving: Stream.Stream<unknown> =
  typeof document === "undefined"
    ? Stream.empty
    : Stream.mergeAll(
        [
          fromEvent(window, "beforeunload", () => "leaving"),
          fromEvent(window, "pagehide", () => "leaving"),
          fromEvent(document, "visibilitychange", () => document.visibilityState).pipe(
            Stream.filter((state) => state === "hidden"),
          ),
        ],
        { concurrency: "unbounded" },
      );

/** Restarted on every keystroke (the revision changes), so this debounces. */
const fieldWritesDue: Stream.Stream<Message> = Stream.merge(
  Stream.fromEffect(Effect.sleep(FIELD_WRITE_DELAY)),
  pageLeaving,
).pipe(
  Stream.take(1),
  Stream.map(() => Message.SettledFieldInput()),
);

/** Reports a detail read that failed, so its page can stop showing "Opening…". */
const reportingDetailFailure = (stream: Stream.Stream<Message>): Stream.Stream<Message> =>
  stream.pipe(
    Stream.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Stream.empty
        : Stream.fromEffect(
            Effect.logError("Optio could not read this item.", cause).pipe(
              Effect.as(Message.FailedDetailLoad()),
            ),
          ),
    ),
  );

/** A template's report, or a failure message its sheet shows instead of loading forever. */
const reportingReportFailure = (templateId: string): Stream.Stream<Message> =>
  templateReportStream(templateId).pipe(
    Stream.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Stream.empty
        : Stream.fromEffect(
            Effect.logError("Optio could not read this template's report.", cause).pipe(
              Effect.as(Message.FailedTemplateReport({ templateId })),
            ),
          ),
    ),
  );

/**
 * Reports a failed list read, so its page shows a retry rather than loading
 * forever. The stream ends; "Try again" restarts it via `listReadAttempt`.
 */
const reportingListFailure =
  (list: StoreList) =>
  (stream: Stream.Stream<Message>): Stream.Stream<Message> =>
    stream.pipe(
      Stream.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Stream.empty
          : Stream.fromEffect(
              Effect.logError("Optio could not read saved data.", cause).pipe(
                Effect.as(Message.FailedListRead({ list })),
              ),
            ),
      ),
    );

/** Logs a failed store read and ends that stream, so one failure can't crash the app. */
const loggingFailure = (stream: Stream.Stream<Message>): Stream.Stream<Message> =>
  stream.pipe(
    Stream.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Stream.empty
        : Stream.fromEffect(Effect.logError("Optio could not read saved data.", cause)).pipe(
            Stream.drain,
          ),
    ),
  );

/**
 * The runner screen shows a live timer; the Start tab shows elapsed time for a
 * session that is still open. History labels days ("Today"), which only needs
 * the time on entry and each minute.
 */
const tickRate = (model: Model): "off" | "second" | "minute" =>
  (model.route._tag === "SessionRunner" && model.runner !== null) ||
  (model.route._tag === "StartTab" && activeSessionOf(model) !== null)
    ? "second"
    : model.route._tag === "HistoryTab"
      ? "minute"
      : "off";

/** Desktop Ctrl/⌘+Enter works on the runner, except while ending the session. */
const runnerShortcutsActive = (model: Model): boolean =>
  model.route._tag === "SessionRunner" && model.runner !== null && !model.runner.showEndConfirm;

/** Agent requests from the connection, while assistant access is approved. */
const agentRequests: Stream.Stream<Message> = Stream.unwrap(
  Effect.gen(function* () {
    const bridge = yield* CurrentAgentBridge;
    return Stream.map(bridge.requests, (request) => Message.AgentRequest(request));
  }),
);

/** The hash route after back, forward, a typed URL or a navigation command. */
const routeChanges: Stream.Stream<Message> =
  typeof window === "undefined"
    ? Stream.empty
    : fromEvent(window, "hashchange", () => Message.GotRoute({ route: parseRoute(location.hash) }));

/**
 * Same-document links (`href="#/..."`) go through update first, so the
 * template editor can ask before leaving unsaved changes. Modified clicks and
 * links that open elsewhere keep the browser's behaviour.
 */
const linkClicks: Stream.Stream<Message> =
  typeof document === "undefined"
    ? Stream.empty
    : fromEventPreventingDefault<MouseEvent, Message>(document, "click", (event) => {
        if (event.defaultPrevented || event.button !== 0) return Option.none();
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return Option.none();
        const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
        const href = link?.getAttribute("href");
        if (
          href == null ||
          !pipe(href, String.startsWith("#/")) ||
          link?.hasAttribute("target") === true
        )
          return Option.none();
        return Option.some(Message.ClickedLink({ url: href }));
      });

/** Store reads and the live timer for the page the Model shows. */
const pageSubscriptions = (model: Model) => {
  const fieldWriteRevision =
    model.runner === null || model.runner.fieldWrites.pending.length === 0
      ? null
      : model.runner.fieldWrites.revision;
  const onRunner = model.route._tag === "SessionRunner";
  return [
    // The templates read waits for the sample-template check (see Model).
    model.templatesSeedChecked &&
      Subscription.make("templates", model.listReadAttempt, () =>
        reportingListFailure("templates")(templatesStream),
      ),
    Subscription.make("history", model.listReadAttempt, () =>
      reportingListFailure("history")(historyStream),
    ),
    Subscription.make("activeSession", model.listReadAttempt, () =>
      reportingListFailure("activeSession")(activeSessionStream),
    ),
    model.route._tag === "SessionDetail" &&
      Subscription.make("historyDetail", model.route.sessionId, (sessionId) =>
        reportingDetailFailure(historyDetailStream(sessionId)),
      ),
    model.route._tag === "TemplateEditor" &&
      Subscription.make("templateDetail", model.route.templateId, (templateId) =>
        reportingDetailFailure(templateDetailStream(templateId)),
      ),
    model.templateReportFor !== null &&
      Subscription.make("templateReport", model.templateReportFor, reportingReportFailure),
    model.route._tag === "SessionRunner" &&
      Subscription.make("runner", model.route.sessionId, (sessionId) =>
        loggingFailure(runnerStream(sessionId)),
      ),
    runnerShortcutsActive(model) && Subscription.make("runnerShortcuts", primaryShortcutPresses),
    fieldWriteRevision !== null &&
      Subscription.make("fieldWriteFlush", [fieldWriteRevision, onRunner], () =>
        onRunner
          ? fieldWritesDue
          : // Leaving the runner writes what it still holds.
            Stream.succeed(Message.SettledFieldInput()),
      ),
    tickRate(model) !== "off" &&
      Subscription.make("ticker", tickRate(model), (rate) =>
        tickStream(rate === "second" ? Duration.seconds(1) : Duration.minutes(1)),
      ),
  ];
};

/** Focus and scroll effects that follow the Model's focus targets. */
const focusSubscriptions = (model: Model) => {
  const helpPage =
    model.route._tag === "AgentHelp" || model.route._tag === "About" ? model.route._tag : null;
  return [
    helpPage !== null && Subscription.make("helpPageEntry", helpPage, focusHelpPage),
    model.editor?.draft != null &&
      Subscription.make("editorDraftFocus", model.editor.draft.id, () => focusEditorDraft),
    model.runner?.focusedSectionId != null &&
      Subscription.make("focusedSectionScroll", model.runner.focusedSectionId, scrollToSection),
    model.runner?.currentTaskId != null &&
      Subscription.make("currentTaskScroll", model.runner.currentTaskId, () => scrollToCurrentTask),
  ];
};

/**
 * The streams the app runs for a Model; `false` entries are off. A
 * subscription restarts when its deps change and stops when it disappears.
 */
export const subscriptions = (model: Model) => [
  model.assistantAccess === "approved" && Subscription.make("agentRequest", agentRequests),
  Subscription.make("route", routeChanges),
  Subscription.make("links", linkClicks),
  Subscription.make("storage", storageStatusStream),
  Subscription.make("saveStall", saveStallStream),
  Subscription.make("appUpdates", appUpdates),
  Subscription.make(
    "systemColorScheme",
    fromMediaQuery("(prefers-color-scheme: dark)", (prefersDark) =>
      Message.ChangedSystemColorScheme({ prefersDark }),
    ),
  ),
  ...pageSubscriptions(model),
  ...focusSubscriptions(model),
];
