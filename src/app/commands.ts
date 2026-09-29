import { Duration, Effect, Schema as S } from "effect";
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
  AdjustCounter,
  EndSession,
  RecordTask,
  SaveEdit,
  SelectTask,
  UpdateFieldValues,
} from "../web/features/session/runnerCommands";
import { templatePrompt } from "../web/features/settings/infoView";
import { randomSessionName } from "../web/random-name";
import {
  planSession,
  type SessionEmission,
  type SessionEvent,
} from "../machine/session/sessionMachine";
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
  messages: [Message.StyleSaveFinished, Message.SupersededStyleSave],
  execute: ({ style }) =>
    Effect.map(changeStyle(style), (result) =>
      result === null
        ? Message.SupersededStyleSave()
        : Message.StyleSaveFinished({ style, ...result }),
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

const CopyTemplatePrompt = Command.define("CopyTemplatePrompt", {
  args: {},
  messages: [Message.TemplatePromptCopyFinished],
  execute: () =>
    Effect.tryPromise(() => navigator.clipboard.writeText(templatePrompt)).pipe(
      Effect.match({
        onSuccess: () => Message.TemplatePromptCopyFinished({ copied: true }),
        onFailure: () => Message.TemplatePromptCopyFinished({ copied: false }),
      }),
    ),
});

const ResetTemplatePromptCopy = Command.define("ResetTemplatePromptCopy", {
  args: {},
  messages: [Message.ResetTemplatePromptCopy],
  execute: () =>
    Effect.sleep(Duration.seconds(3)).pipe(Effect.as(Message.ResetTemplatePromptCopy())),
});

const GeneratePlaceholderName = Command.define("GeneratePlaceholderName", {
  args: {},
  messages: [Message.GotPlaceholderName],
  execute: () => Effect.map(randomSessionName, (name) => Message.GotPlaceholderName({ name })),
});

const ReplyToAgent = Command.define("ReplyToAgent", {
  args: { reply: AgentPortReply },
  messages: [Message.CompletedReplyToAgent],
  execute: ({ reply }) =>
    Port.emit(agentPorts.outbound.agentReply, reply).pipe(
      Effect.as(Message.CompletedReplyToAgent()),
    ),
});

// ── Session planner bridge (pure reducer → FoldKit commands) ─────────────

const emissionToCommand = (emission: SessionEmission): Update.Commands<Message> => {
  switch (emission._tag) {
    case "CommitFieldValues":
      return [UpdateFieldValues({ writes: emission.writes })];
    case "CommitCounterAdjustment":
      return [AdjustCounter({ taskFieldId: emission.taskFieldId, delta: emission.delta })];
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

/** Plan a session event; merge the result into model + commands. */
const applyPlan = (model: Model, event: SessionEvent): Update.Return<Model, Message> => {
  const plan = planSession({ runner: model.runner, now: model.now }, event);
  // The planner returns the same runner reference for events that don't apply.
  if (plan.runner === model.runner && plan.emissions.length === 0) return { model };
  return {
    model: { ...model, runner: plan.runner },
    commands: plan.emissions.flatMap(emissionToCommand),
  };
};

export {
  CopyTemplatePrompt,
  GeneratePlaceholderName,
  NavigateExternal,
  NavigateInternal,
  ReplyToAgent,
  ResetTemplatePromptCopy,
  SaveAccent,
  SaveFont,
  SaveIconLibrary,
  SaveStyle,
  SaveTheme,
  applyPlan,
};
