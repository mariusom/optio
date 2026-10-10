import { Duration, Effect, Match, Schema } from "effect";
import { Command, Navigation, Port, Update } from "foldkit";
import { Message } from "../messages";
import { AgentPortReply, agentPorts } from "../agents/actions";
import {
  changeAccent,
  changeControlSize,
  changeFont,
  changeIconLibrary,
  changeLook,
  applyColorScheme,
  changeStyle,
  saveThemeChoice,
} from "../web/browserTheme";
import { Accent, ControlSize, Font, IconLibrary, Look, Theme } from "../web/theme";
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
  args: { url: Schema.String },
  messages: [Message.Navigated],
  execute: ({ url }) => Effect.map(Navigation.pushUrl(url), () => Message.Navigated()),
});

const SaveTheme = Command.define("SaveTheme", {
  args: { theme: Theme },
  messages: [Message.ThemeSaveFinished],
  execute: ({ theme }) =>
    Effect.map(saveThemeChoice(theme), (saved) => Message.ThemeSaveFinished({ theme, saved })),
});

const ApplyColorScheme = Command.define("ApplyColorScheme", {
  args: { dark: Schema.Boolean },
  messages: [Message.AppliedColorScheme],
  execute: ({ dark }) => Effect.as(applyColorScheme(dark), Message.AppliedColorScheme()),
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

const SaveLook = Command.define("SaveLook", {
  args: { look: Look },
  messages: [Message.LookSaveFinished],
  execute: ({ look }) =>
    Effect.map(changeLook(look), (saved) => Message.LookSaveFinished({ look, saved })),
});

const SaveControlSize = Command.define("SaveControlSize", {
  args: { controlSize: ControlSize },
  messages: [Message.ControlSizeSaveFinished],
  execute: ({ controlSize }) =>
    Effect.map(changeControlSize(controlSize), (saved) =>
      Message.ControlSizeSaveFinished({ controlSize, saved }),
    ),
});

const NavigateExternal = Command.define("NavigateExternal", {
  args: { href: Schema.String },
  messages: [Message.Navigated],
  execute: ({ href }) => Effect.map(Navigation.load(href), () => Message.Navigated()),
});

const CopyTemplatePrompt = Command.define("CopyTemplatePrompt", {
  messages: [Message.TemplatePromptCopyFinished],
  execute: Effect.tryPromise(() => navigator.clipboard.writeText(templatePrompt)).pipe(
    Effect.match({
      onSuccess: () => Message.TemplatePromptCopyFinished({ copied: true }),
      onFailure: () => Message.TemplatePromptCopyFinished({ copied: false }),
    }),
  ),
});

const ResetTemplatePromptCopy = Command.define("ResetTemplatePromptCopy", {
  messages: [Message.ResetTemplatePromptCopy],
  execute: Effect.sleep(Duration.seconds(3)).pipe(Effect.as(Message.ResetTemplatePromptCopy())),
});

const GeneratePlaceholderName = Command.define("GeneratePlaceholderName", {
  messages: [Message.GotPlaceholderName],
  execute: Effect.map(randomSessionName, (name) => Message.GotPlaceholderName({ name })),
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

const emissionToCommand = (emission: SessionEmission): Update.Commands<Message> =>
  Match.valueTags(emission, {
    CommitFieldValues: ({ writes }) => [UpdateFieldValues({ writes })],
    CommitCounterAdjustment: ({ taskFieldId, delta }) => [AdjustCounter({ taskFieldId, delta })],
    CommitRecord: ({ sessionId, taskId }) => [RecordTask({ sessionId, currentTaskId: taskId })],
    CommitSelectTask: ({ sessionId, taskId }) => [SelectTask({ sessionId, taskId })],
    CommitCancelEdit: ({ taskId }) => [CancelEdit({ taskId })],
    CommitSaveEdit: ({ taskId }) => [SaveEdit({ taskId })],
    CommitEndSession: ({ sessionId }) => [EndSession({ sessionId })],
  });

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
  ApplyColorScheme,
  CopyTemplatePrompt,
  GeneratePlaceholderName,
  NavigateExternal,
  NavigateInternal,
  ReplyToAgent,
  ResetTemplatePromptCopy,
  SaveAccent,
  SaveControlSize,
  SaveFont,
  SaveIconLibrary,
  SaveLook,
  SaveStyle,
  SaveTheme,
  applyPlan,
};
