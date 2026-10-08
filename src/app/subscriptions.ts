import { Cause, Clock, Duration, Effect, Stream, Schema as S } from "effect";
import { Port, Subscription } from "foldkit";
import { agentPorts } from "../agents/actions";
import { Message } from "../messages";
import type { Model } from "./model";
import { historyDetailStream, historyStream } from "./historyStreams";
import { activeSessionStream, runnerStream } from "./sessionStreams";
import { storageStatusStream } from "./storageStreams";
import { templateDetailStream, templatesStream } from "./templateStreams";
import {
  focusEditorDraft,
  focusHelpPage,
  scrollToCurrentTask,
  scrollToSection,
} from "./domStreams";

const isDocumentVisible = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

/** Emits the current visibility, then each change, so hidden tabs can pause work. */
const documentVisibility: Stream.Stream<boolean> =
  typeof document === "undefined"
    ? Stream.succeed(true)
    : Stream.concat(
        Stream.suspend(() => Stream.succeed(isDocumentVisible())),
        Stream.fromEventListener(document, "visibilitychange").pipe(Stream.map(isDocumentVisible)),
      ).pipe(Stream.changes);

// Reads the time through Effect's Clock, so a test runtime can supply it, and
// the Model carries the value; views never read the clock themselves. Ticks
// pause while the tab is hidden; `Stream.tick` emits at once, so returning to
// the tab refreshes the time immediately.
const tickStream: Stream.Stream<Message> = documentVisibility.pipe(
  Stream.switchMap((visible) => (visible ? Stream.tick(Duration.seconds(1)) : Stream.empty)),
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
          Stream.fromEventListener(window, "beforeunload"),
          Stream.fromEventListener(window, "pagehide"),
          Stream.fromEventListener(document, "visibilitychange").pipe(
            Stream.filter(() => document.visibilityState === "hidden"),
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

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  agentRequest: Port.subscription(agentPorts.inbound.agentRequest, Message.AgentRequest),
  storage: Subscription.persistent(storageStatusStream),
  templates: Subscription.persistent(loggingFailure(templatesStream)),
  history: Subscription.persistent(loggingFailure(historyStream)),
  historyDetail: entry(
    { sessionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionDetail" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null ? Stream.empty : reportingDetailFailure(historyDetailStream(sessionId)),
    },
  ),
  templateDetail: entry(
    { templateId: S.Union([S.Null, S.String]) },
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
  activeSession: Subscription.persistent(loggingFailure(activeSessionStream)),
  runner: entry(
    { sessionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionRunner" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null ? Stream.empty : loggingFailure(runnerStream(sessionId)),
    },
  ),
  fieldWriteFlush: entry(
    { revision: S.Union([S.Null, S.Number]), onRunner: S.Boolean },
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
    { active: S.Boolean },
    {
      modelToDependencies: (model) => ({
        // The runner screen shows a live timer; the Start tab shows elapsed
        // time for a session that is still open.
        active:
          (model.route._tag === "SessionRunner" && model.runner !== null) ||
          (model.route._tag === "StartTab" && model.activeSession !== null),
      }),
      dependenciesToStream: ({ active }) => (active ? tickStream : Stream.empty),
    },
  ),
  helpPageEntry: entry(
    { page: S.Union([S.Null, S.Literals(["AgentHelp", "About"])]) },
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
    { draftId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({ draftId: model.editor?.draft?.id ?? null }),
      dependenciesToStream: ({ draftId }) => focusEditorDraft(draftId),
    },
  ),
  focusedSectionScroll: entry(
    { focusedSectionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        focusedSectionId: model.runner?.focusedSectionId ?? null,
      }),
      dependenciesToStream: ({ focusedSectionId }) => scrollToSection(focusedSectionId),
    },
  ),
  currentTaskScroll: entry(
    { currentTaskId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        currentTaskId: model.runner?.currentTaskId ?? null,
      }),
      dependenciesToStream: ({ currentTaskId }) => scrollToCurrentTask(currentTaskId),
    },
  ),
}));
