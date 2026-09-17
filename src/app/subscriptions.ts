import { Duration, Effect, Stream, Schema as S } from "effect";
import { Port, Subscription } from "foldkit";
import { agentPorts } from "../agents/actions";
import { Message } from "../messages";
import type { Model } from "./model";
import { historyDetailStream, historyStream } from "./historyStreams";
import { activeSessionStream, runnerStream } from "./sessionStreams";
import { templateDetailStream, templatesStream } from "./templateStreams";
import {
  focusEditorDraft,
  focusHelpPage,
  scrollToCurrentTask,
  scrollToSection,
} from "./domStreams";

const tickStream: Stream.Stream<Message> = Stream.tick(Duration.seconds(1)).pipe(
  Stream.map(() => Message.Tick({ now: Date.now() })),
);

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  agentRequest: Port.subscription(agentPorts.inbound.agentRequest, Message.AgentRequest),
  templates: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () =>
        Stream.when(
          templatesStream,
          Effect.sync(() => true),
        ),
    },
  ),
  history: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () =>
        Stream.when(
          historyStream,
          Effect.sync(() => true),
        ),
    },
  ),
  historyDetail: entry(
    { sessionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionDetail" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null
          ? Stream.empty
          : Stream.when(
              historyDetailStream(sessionId),
              Effect.sync(() => true),
            ),
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
          : Stream.when(
              templateDetailStream(templateId),
              Effect.sync(() => true),
            ),
    },
  ),
  activeSession: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () =>
        Stream.when(
          activeSessionStream,
          Effect.sync(() => true),
        ),
    },
  ),
  runner: entry(
    { sessionId: S.Union([S.Null, S.String]) },
    {
      modelToDependencies: (model) => ({
        sessionId: model.route._tag === "SessionRunner" ? model.route.sessionId : null,
      }),
      dependenciesToStream: ({ sessionId }) =>
        sessionId === null
          ? Stream.empty
          : Stream.when(
              runnerStream(sessionId),
              Effect.sync(() => true),
            ),
    },
  ),
  ticker: entry(
    { active: S.Boolean },
    {
      modelToDependencies: (model) => ({
        active: model.route._tag === "SessionRunner" && model.runner !== null,
      }),
      dependenciesToStream: ({ active }) =>
        Stream.when(
          tickStream,
          Effect.sync(() => active),
        ),
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
