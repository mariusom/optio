import { Effect, Schema as S } from "effect";
import { Command, Navigation, Port, Update } from "foldkit";
import { Message } from "../messages";
import { AgentPortReply, agentPorts } from "../agents/actions";
import {
  changeAccent,
  changeFont,
  changeIconLibrary,
  changeStyle,
  changeTheme,
} from "../web/browserTheme";
import { Accent, Font, IconLibrary, Theme } from "../web/theme";
import { FoldcnStyle } from "../web/style";
import {
  CancelEdit,
  EndSession,
  RecordTask,
  SaveEdit,
  SelectTask,
  UpdateFieldValue,
} from "../web/features/session/runnerCommands";
import { planSession, type SessionEmission } from "../machine/session/plan";
import type { SessionEvent } from "../machine/session/sessionMachine";
import type { Model } from "./model";

const NavigateInternal = Command.define("NavigateInternal", {
  args: { url: S.String },
  messages: [Message.Navigated],
  execute: ({ url }) => Effect.map(Navigation.pushUrl(url), () => Message.Navigated()),
});

const SaveTheme = Command.define("SaveTheme", {
  args: { theme: Theme },
  messages: [Message.ThemeSaveFinished],
  execute: ({ theme }) =>
    Effect.map(changeTheme(theme), (saved) => Message.ThemeSaveFinished({ theme, saved })),
});

const SaveStyle = Command.define("SaveStyle", {
  args: { style: FoldcnStyle },
  messages: [Message.StyleSaveFinished, Message.Navigated],
  execute: ({ style }) =>
    Effect.map(changeStyle(style), (result) =>
      result === null ? Message.Navigated() : Message.StyleSaveFinished({ style, ...result }),
    ),
});

const SaveFont = Command.define("SaveFont", {
  args: { font: Font },
  messages: [Message.FontSaveFinished],
  execute: ({ font }) =>
    Effect.map(changeFont(font), (saved) => Message.FontSaveFinished({ font, saved })),
});

const SaveIconLibrary = Command.define("SaveIconLibrary", {
  args: { library: IconLibrary },
  messages: [Message.IconLibrarySaveFinished],
  execute: ({ library }) =>
    Effect.map(changeIconLibrary(library), (saved) =>
      Message.IconLibrarySaveFinished({ library, saved }),
    ),
});

const SaveAccent = Command.define("SaveAccent", {
  args: { accent: Accent },
  messages: [Message.AccentSaveFinished],
  execute: ({ accent }) =>
    Effect.map(changeAccent(accent), (saved) => Message.AccentSaveFinished({ accent, saved })),
});

const NavigateExternal = Command.define("NavigateExternal", {
  args: { href: S.String },
  messages: [Message.Navigated],
  execute: ({ href }) => Effect.map(Navigation.load(href), () => Message.Navigated()),
});

const ReplyToAgent = Command.define("ReplyToAgent", {
  args: { reply: AgentPortReply },
  messages: [Message.Navigated],
  execute: ({ reply }) =>
    Port.emit(agentPorts.outbound.agentReply, reply).pipe(Effect.as(Message.Navigated())),
});

// ── Runner state machine bridge (effect-machine → FoldKit) ───────────────

const emissionToCommand = (emission: SessionEmission): Update.Commands<Message> => {
  switch (emission._tag) {
    case "CommitFieldValue":
      return [UpdateFieldValue({ taskFieldId: emission.taskFieldId, value: emission.value })];
    case "CommitRecord":
      return [RecordTask({ sessionId: emission.sessionId, currentTaskId: emission.taskId })];
    case "CommitSelectTask":
      return [SelectTask({ sessionId: emission.sessionId, taskId: emission.taskId })];
    case "CommitCancelEdit":
      return [CancelEdit({ taskId: emission.taskId })];
    case "CommitSaveEdit":
      return [SaveEdit({ taskId: emission.taskId })];
    case "CommitEndSession":
      return [EndSession({ sessionId: emission.sessionId })];
  }
};

/** Plan a Session-machine event; merge the result into model + commands. */
const applyPlan = (model: Model, event: SessionEvent) => {
  const plan = planSession(model.runner, model.runnerPhase, event);
  const changed =
    plan.runner !== model.runner || plan.phase !== model.runnerPhase || plan.emissions.length > 0;
  return changed
    ? {
        model: { ...model, runner: plan.runner, runnerPhase: plan.phase },
        commands: plan.emissions.flatMap(emissionToCommand),
      }
    : { model };
};

export {
  NavigateExternal,
  NavigateInternal,
  ReplyToAgent,
  SaveAccent,
  SaveFont,
  SaveIconLibrary,
  SaveStyle,
  SaveTheme,
  applyPlan,
};
