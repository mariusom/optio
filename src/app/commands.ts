import { Array, Effect, Match, Schema } from "effect";
import { Command, Component } from "@effect/ui";
import { Message, type AppCommand, type UpdateResult } from "../messages";
import { AgentPortReply } from "../agents/actions";
import { CurrentAgentBridge } from "../agents/bridge";
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
import { VibrateRecorded } from "../web/features/session/recordFeedback";
import { randomSessionName } from "../web/random-name";
import {
  planSession,
  type SessionEmission,
  type SessionEvent,
} from "../machine/session/sessionMachine";
import type { Model } from "./model";

/** Same-document hash navigation; the `hashchange` subscription reports the new route. */
const NavigateInternal = Command.make(
  "NavigateInternal",
  { args: { url: Schema.String } },
  ({ url }) =>
    Effect.sync(() => {
      location.href = url;
    }).pipe(Effect.as(Component.noop)),
);

const SaveTheme = Command.make("SaveTheme", { args: { theme: Theme } }, ({ theme }) =>
  Effect.map(saveThemeChoice(theme), (saved) => Message.CompletedSaveTheme({ theme, saved })),
);

const ApplyColorScheme = Command.make(
  "ApplyColorScheme",
  { args: { dark: Schema.Boolean } },
  ({ dark }) => Effect.as(applyColorScheme(dark), Message.CompletedApplyColorScheme()),
);

const SaveStyle = Command.make("SaveStyle", { args: { style: FoldcnStyle } }, ({ style }) =>
  Effect.map(changeStyle(style), (result) =>
    // A newer selection superseded this one before its styles loaded.
    result === null ? Component.noop : Message.CompletedSaveStyle({ style, ...result }),
  ),
);

const SaveFont = Command.make("SaveFont", { args: { font: Font } }, ({ font }) =>
  Effect.map(changeFont(font), (saved) => Message.CompletedSaveFont({ font, saved })),
);

const SaveIconLibrary = Command.make(
  "SaveIconLibrary",
  { args: { library: IconLibrary } },
  ({ library }) =>
    Effect.map(changeIconLibrary(library), (saved) =>
      Message.CompletedSaveIconLibrary({ library, saved }),
    ),
);

const SaveAccent = Command.make("SaveAccent", { args: { accent: Accent } }, ({ accent }) =>
  Effect.map(changeAccent(accent), (saved) => Message.CompletedSaveAccent({ accent, saved })),
);

const SaveLook = Command.make("SaveLook", { args: { look: Look } }, ({ look }) =>
  Effect.map(changeLook(look), (saved) => Message.CompletedSaveLook({ look, saved })),
);

const SaveControlSize = Command.make(
  "SaveControlSize",
  { args: { controlSize: ControlSize } },
  ({ controlSize }) =>
    Effect.map(changeControlSize(controlSize), (saved) =>
      Message.CompletedSaveControlSize({ controlSize, saved }),
    ),
);

const GeneratePlaceholderName = Command.make("GeneratePlaceholderName", { args: {} }, () =>
  Effect.map(randomSessionName, (name) => Message.CompletedGeneratePlaceholderName({ name })),
);

const ReplyToAgent = Command.make(
  "ReplyToAgent",
  { args: { reply: AgentPortReply } },
  ({ reply }) =>
    Effect.gen(function* () {
      const bridge = yield* CurrentAgentBridge;
      yield* bridge.reply(reply);
      return Component.noop;
    }),
);

// ── Session planner bridge (pure reducer → Effect UI commands) ─────────────

const emissionToCommand = (emission: SessionEmission): ReadonlyArray<AppCommand> =>
  Match.valueTags(emission, {
    CommitFieldValues: ({ writes }) => [UpdateFieldValues.make({ writes })],
    CommitCounterAdjustment: ({ taskFieldId, delta }) => [
      AdjustCounter.make({ taskFieldId, delta }),
    ],
    CommitRecord: ({ sessionId, taskId }) => [
      RecordTask.make({ sessionId, currentTaskId: taskId }),
    ],
    ConfirmRecorded: () => [VibrateRecorded.make({})],
    CommitSelectTask: ({ sessionId, taskId }) => [SelectTask.make({ sessionId, taskId })],
    CommitCancelEdit: ({ taskId }) => [CancelEdit.make({ taskId })],
    CommitSaveEdit: ({ taskId }) => [SaveEdit.make({ taskId })],
    CommitEndSession: ({ sessionId }) => [EndSession.make({ sessionId })],
  });

/** Plan a session event; merge the result into model + commands. */
const applyPlan = (model: Model, event: SessionEvent): UpdateResult<Model> => {
  const plan = planSession({ runner: model.runner, now: model.now }, event);
  // The planner returns the same runner reference for events that don't apply.
  if (plan.runner === model.runner && plan.emissions.length === 0) return { model };
  return {
    model: { ...model, runner: plan.runner },
    commands: Array.flatMap(plan.emissions, emissionToCommand),
  };
};

export {
  ApplyColorScheme,
  GeneratePlaceholderName,
  NavigateInternal,
  ReplyToAgent,
  SaveAccent,
  SaveControlSize,
  SaveFont,
  SaveIconLibrary,
  SaveLook,
  SaveStyle,
  SaveTheme,
  applyPlan,
};
