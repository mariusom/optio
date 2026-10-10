import { DiscardLiveSession, StartSession } from "../web/features/session/startCommands";
import { resolveSelectedTemplate } from "../web/features/session/startHelpers";
import { sessionRunnerRouter } from "../web/routes";
import { GeneratePlaceholderName, NavigateInternal, applyPlan } from "./commands";
import type { Update } from "foldkit";
import { Message, type MessageHandlers } from "../messages";
import { AsyncData } from "foldkit";
import { activeSessionOf, takeId, templatesOf, type Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = MessageHandlers<Result>;

type SessionHandlers = Pick<
  AllHandlers,
  | "GotActiveSession"
  | "ChangedSessionNameInput"
  | "GotPlaceholderName"
  | "SelectedTemplate"
  | "ClickedStartSession"
  | "SessionStarted"
  | "ClickedResumeSession"
  | "ClickedDiscardSession"
  | "CanceledDiscardSession"
  | "ConfirmedDiscardSession"
  | "SessionDiscarded"
  | "FailedSessionOp"
  | "GotRunnerData"
  | "Tick"
  | "ChangedFieldValue"
  | "SettledFieldInput"
  | "BlurredField"
  | "AdjustedCounter"
  | "ClickedRecord"
  | "TaskRecorded"
  | "ClickedEndSession"
  | "CanceledEndSession"
  | "ConfirmedEndSession"
  | "SessionEnded"
  | "ClickedSelectTask"
  | "ToggledTaskList"
  | "FocusedSection"
  | "ClickedCancelEdit"
  | "ClickedSaveEdit"
  | "TaskEditStarted"
  | "UpdatedFieldValue"
  | "TaskEditFinished"
  | "FailedRunnerOp"
  | "DismissedRunnerError"
  | "ToggledSidebar"
>;
export const sessionHandlers = (model: Model): SessionHandlers => ({
  GotActiveSession: ({ activeSession }) => ({
    model: { ...model, activeSession: AsyncData.succeed(activeSession) },
  }),
  ChangedSessionNameInput: ({ text }) => ({ model: { ...model, sessionNameInput: text } }),
  GotPlaceholderName: ({ name }) => ({ model: { ...model, placeholderName: name } }),
  SelectedTemplate: ({ id }) => ({ model: { ...model, selectedTemplateId: id } }),
  ClickedStartSession: () => {
    const selected = resolveSelectedTemplate(templatesOf(model), model.selectedTemplateId);
    if (selected === null) return { model };
    const sessionName =
      model.sessionNameInput.trim() !== "" ? model.sessionNameInput.trim() : model.placeholderName;
    const [id, next] = takeId(model);
    // Pass empty fields array; StartSession will resolve via store fallback
    return {
      model: next,
      commands: [
        StartSession({
          id,
          templateId: selected.id,
          templateName: selected.name,
          sessionName,
          fields: [],
        }),
      ],
    };
  },
  SessionStarted: ({ sessionId }) => ({
    model: {
      ...model,
      sessionNameInput: "",
      lastError: null,
    },
    commands: [
      GeneratePlaceholderName(),
      NavigateInternal({ url: `#${sessionRunnerRouter({ sessionId })}` }),
    ],
  }),
  ClickedResumeSession: () => {
    const active = activeSessionOf(model);
    if (active === null) return { model };
    return {
      model,
      commands: [
        NavigateInternal({
          url: `#${sessionRunnerRouter({ sessionId: active.id })}`,
        }),
      ],
    };
  },
  ClickedDiscardSession: () => ({ model: { ...model, pendingDiscardSession: true } }),
  CanceledDiscardSession: () => ({ model: { ...model, pendingDiscardSession: false } }),
  ConfirmedDiscardSession: () => {
    const active = activeSessionOf(model);
    if (active === null) return { model: { ...model, pendingDiscardSession: false } };
    return {
      model: { ...model, pendingDiscardSession: false },
      commands: [DiscardLiveSession({ sessionId: active.id })],
    };
  },
  SessionDiscarded: () => ({
    model: {
      ...model,
      activeSession: AsyncData.succeed(null),
      pendingDiscardSession: false,
      lastError: null,
    },
    commands: [GeneratePlaceholderName()],
  }),
  FailedSessionOp: ({ error }) => ({
    model: { ...model, lastError: error, pendingDiscardSession: false },
  }),

  GotRunnerData: ({ data }) => {
    const planned = applyPlan(model, { _tag: "DataSynced", data });
    // Dead link / store reset mid-session: the runner route has no live
    // session — bounce to Start instead of an infinite "Loading session…".
    if (data === null && model.route._tag === "SessionRunner" && planned.model.runner === null) {
      return {
        model: planned.model,
        commands: [...(planned.commands ?? []), NavigateInternal({ url: "#/start" })],
      };
    }
    return planned;
  },
  Tick: ({ now }) => {
    const runner = model.runner === null ? null : { ...model.runner, now };
    return { model: { ...model, now, runner } };
  },
  ChangedFieldValue: ({ taskFieldId, value }) =>
    applyPlan(model, { _tag: "FieldChanged", taskFieldId, value }),
  SettledFieldInput: () => applyPlan(model, { _tag: "FlushRequested" }),
  BlurredField: () => applyPlan(model, { _tag: "FlushRequested" }),
  AdjustedCounter: ({ taskFieldId, delta }) =>
    applyPlan(model, { _tag: "CounterAdjusted", taskFieldId, delta }),
  ClickedRecord: () => applyPlan(model, { _tag: "RecordRequested" }),
  TaskRecorded: () => applyPlan(model, { _tag: "RecordAcked" }),
  ClickedEndSession: () => applyPlan(model, { _tag: "EndRequested" }),
  CanceledEndSession: () => applyPlan(model, { _tag: "EndCancelled" }),
  ConfirmedEndSession: () => applyPlan(model, { _tag: "EndConfirmed" }),
  SessionEnded: () => {
    const planned = applyPlan(model, { _tag: "EndAcked" });
    return {
      model: planned.model,
      commands: [
        ...(planned.commands ?? []),
        GeneratePlaceholderName(),
        NavigateInternal({ url: "#/start" }),
      ],
    };
  },
  ClickedSelectTask: ({ taskId }) => applyPlan(model, { _tag: "TaskSelected", taskId }),
  ToggledTaskList: () => applyPlan(model, { _tag: "TaskListToggled" }),
  FocusedSection: ({ fieldId }) => applyPlan(model, { _tag: "SectionFocused", fieldId }),
  ClickedCancelEdit: () => applyPlan(model, { _tag: "EditCancelled" }),
  ClickedSaveEdit: () => applyPlan(model, { _tag: "EditSaved" }),
  TaskEditStarted: () => ({ model }),
  UpdatedFieldValue: () => ({ model }),
  TaskEditFinished: () => applyPlan(model, { _tag: "EditAcked" }),
  FailedRunnerOp: ({ error }) => {
    if (model.runner === null) return { model: { ...model, lastError: error } };
    return { model: { ...model, runner: { ...model.runner, lastError: error } } };
  },
  DismissedRunnerError: () => {
    if (model.runner === null) return { model: { ...model, lastError: null } };
    return { model: { ...model, runner: { ...model.runner, lastError: null } } };
  },
  ToggledSidebar: () => {
    if (model.runner === null) return { model };
    return {
      model: { ...model, runner: { ...model.runner, showSidebar: !model.runner.showSidebar } },
    };
  },
});
