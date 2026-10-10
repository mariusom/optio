import { Cause, Clock, Duration, Effect, Stream, Schema } from "effect";
import { Dom, Port, Subscription } from "foldkit";
import { agentPorts } from "../agents/actions";
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
import { primaryShortcutPresses } from "../web/features/session/runnerShortcuts";

const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

/** Emits the current visibility, then each change, so hidden tabs can pause work. */
const documentVisibility: Stream.Stream<boolean> =
  typeof document === "undefined"
    ? Stream.succeed(true)
    : Stream.concat(
        Stream.suspend(() => Stream.succeed(isDocumentVisible())),
        Dom.streamFromEvent({
          target: document,
          type: "visibilitychange",
          mapEvent: isDocumentVisible,
        }),
      ).pipe(Stream.changes);

// Reads the time through Effect's Clock, so a test runtime can supply it, and
// the Model carries the value; views never read the clock themselves. Ticks
// pause while the tab is hidden; `Stream.tick` emits at once, so returning to
// the tab refreshes the time immediately.
const tickStream = (interval: Duration.Duration): Stream.Stream<Message> =>
  documentVisibility.pipe(
    Stream.switchMap((visible) => (visible ? Stream.tick(interval) : Stream.empty)),
    Stream.mapEffect(() => Clock.currentTimeMillis),
    Stream.map((now) => Message.Tick({ now })),
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
          Dom.streamFromEvent({ target: window, type: "beforeunload", mapEvent: () => "leaving" }),
          Dom.streamFromEvent({ target: window, type: "pagehide", mapEvent: () => "leaving" }),
          Dom.streamFromEvent({
            target: document,
            type: "visibilitychange",
            mapEvent: () => document.visibilityState,
          }).pipe(Stream.filter((state) => state === "hidden")),
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

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  agentRequest: Port.subscriptionEntry(agentPorts.inbound.agentRequest, Message.AgentRequest),
  storage: Subscription.persistentEntry(storageStatusStream),
  appUpdates: Subscription.persistentEntry(appUpdates),
  systemColorScheme: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: "(prefers-color-scheme: dark)",
      mapMatches: (prefersDark) => Message.ChangedSystemColorScheme({ prefersDark }),
    }),
  ),
  templates: entry(
    { seedChecked: Schema.Boolean, attempt: Schema.Number },
    {
      modelToDependencies: (model) => ({
        seedChecked: model.templatesSeedChecked,
        attempt: model.listReadAttempt,
      }),
      dependenciesToStream: ({ seedChecked }) =>
        seedChecked ? reportingListFailure("templates")(templatesStream) : Stream.empty,
    },
  ),
  history: entry(
    { attempt: Schema.Number },
    {
      modelToDependencies: (model) => ({ attempt: model.listReadAttempt }),
      dependenciesToStream: () => reportingListFailure("history")(historyStream),
    },
  ),
  historyDetail: entry(
    { sessionId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionDetail" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null ? Stream.empty : reportingDetailFailure(historyDetailStream(sessionId)),
    },
  ),
  templateDetail: entry(
    { templateId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({
        templateId: model.route._tag === "TemplateEditor" ? model.route.templateId : null,
      }),
      dependenciesToStream: ({ templateId }) =>
        templateId === null
          ? Stream.empty
          : reportingDetailFailure(templateDetailStream(templateId)),
    },
  ),
  templateReport: entry(
    { templateId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({ templateId: model.templateReportFor }),
      dependenciesToStream: ({ templateId }) =>
        templateId === null ? Stream.empty : reportingReportFailure(templateId),
    },
  ),
  activeSession: entry(
    { attempt: Schema.Number },
    {
      modelToDependencies: (model) => ({ attempt: model.listReadAttempt }),
      dependenciesToStream: () => reportingListFailure("activeSession")(activeSessionStream),
    },
  ),
  runner: entry(
    { sessionId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionRunner" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null ? Stream.empty : loggingFailure(runnerStream(sessionId)),
    },
  ),
  runnerShortcuts: entry(
    { active: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ active: runnerShortcutsActive(model) }),
      dependenciesToStream: ({ active }) => (active ? primaryShortcutPresses : Stream.empty),
    },
  ),
  fieldWriteFlush: entry(
    { revision: Schema.Union([Schema.Null, Schema.Number]), onRunner: Schema.Boolean },
    {
      modelToDependencies: (model) => ({
        revision:
          model.runner === null || model.runner.fieldWrites.pending.length === 0
            ? null
            : model.runner.fieldWrites.revision,
        onRunner: model.route._tag === "SessionRunner",
      }),
      dependenciesToStream: ({ revision, onRunner }) =>
        revision === null
          ? Stream.empty
          : onRunner
            ? fieldWritesDue
            : // Leaving the runner writes what it still holds.
              Stream.succeed(Message.SettledFieldInput()),
    },
  ),
  ticker: entry(
    { rate: Schema.Literals(["off", "second", "minute"]) },
    {
      modelToDependencies: (model) => ({ rate: tickRate(model) }),
      dependenciesToStream: ({ rate }) =>
        rate === "off"
          ? Stream.empty
          : tickStream(rate === "second" ? Duration.seconds(1) : Duration.minutes(1)),
    },
  ),
  helpPageEntry: entry(
    { page: Schema.Union([Schema.Null, Schema.Literals(["AgentHelp", "About"])]) },
    {
      modelToDependencies: (model) => ({
        page:
          model.route._tag === "AgentHelp" || model.route._tag === "About"
            ? model.route._tag
            : null,
      }),
      dependenciesToStream: ({ page }) => focusHelpPage(page),
    },
  ),
  editorDraftFocus: entry(
    { draftId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({ draftId: model.editor?.draft?.id ?? null }),
      dependenciesToStream: ({ draftId }) => focusEditorDraft(draftId),
    },
  ),
  focusedSectionScroll: entry(
    { focusedSectionId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({
        focusedSectionId: model.runner?.focusedSectionId ?? null,
      }),
      dependenciesToStream: ({ focusedSectionId }) => scrollToSection(focusedSectionId),
    },
  ),
  currentTaskScroll: entry(
    { currentTaskId: Schema.Union([Schema.Null, Schema.String]) },
    {
      modelToDependencies: (model) => ({
        currentTaskId: model.runner?.currentTaskId ?? null,
      }),
      dependenciesToStream: ({ currentTaskId }) => scrollToCurrentTask(currentTaskId),
    },
  ),
}));
