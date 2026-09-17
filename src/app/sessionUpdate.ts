import { DiscardLiveSession, StartSession } from "../web/features/session/startCommands";
import { resolveSelectedTemplate } from "../web/features/session/startHelpers";
import { generateSessionName } from "../web/random-name";
import { sessionRunnerRouter } from "../web/routes";
import type { SessionEvent } from "../machine/session/sessionMachine";
import { NavigateInternal, applyPlan } from "./commands";
import type { Update } from "foldkit";
import { Message } from "../messages";
import type { Model } from "./model";

type Result = Update.Return<Model, Message>;
type AllHandlers = Parameters<typeof Message.match<Result>>[1];

type SessionHandlers = Pick<
  AllHandlers,
  | "GotActiveSession"
  | "ChangedSessionNameInput"
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
  GotActiveSession: ({ activeSession }) => ({ model: { ...model, activeSession } }),
  ChangedSessionNameInput: ({ text }) => ({ model: { ...model, sessionNameInput: text } }),
  SelectedTemplate: ({ id }) => ({ model: { ...model, selectedTemplateId: id } }),
  ClickedStartSession: () => {
    const selected = resolveSelectedTemplate(model.templates, model.selectedTemplateId);
    if (selected === null) return { model };
    const sessionName =
      model.sessionNameInput.trim() !== "" ? model.sessionNameInput.trim() : model.placeholderName;
    const id = crypto.randomUUID();
    // Pass empty fields array; StartSession will resolve via store fallback
    return {
      model,
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
      placeholderName: generateSessionName(),
      lastError: null,
    },
    commands: [NavigateInternal({ url: `#${sessionRunnerRouter({ sessionId })}` })],
  }),
  ClickedResumeSession: () => {
    if (model.activeSession === null) return { model };
    return {
      model,
      commands: [
        NavigateInternal({
          url: `#${sessionRunnerRouter({ sessionId: model.activeSession.id })}`,
        }),
      ],
    };
  },
  ClickedDiscardSession: () => ({ model: { ...model, pendingDiscardSession: true } }),
  CanceledDiscardSession: () => ({ model: { ...model, pendingDiscardSession: false } }),
  ConfirmedDiscardSession: () => {
    if (model.activeSession === null) return { model: { ...model, pendingDiscardSession: false } };
    return {
      model: { ...model, pendingDiscardSession: false },
      commands: [DiscardLiveSession({ sessionId: model.activeSession.id })],
    };
  },
  SessionDiscarded: () => ({
    model: {
      ...model,
      activeSession: null,
      pendingDiscardSession: false,
      placeholderName: generateSessionName(),
      lastError: null,
    },
  }),
  FailedSessionOp: ({ error }) => ({
    model: { ...model, lastError: error, pendingDiscardSession: false },
  }),

  GotRunnerData: ({ data }) => {
    const planned = applyPlan(model, { _tag: "DataSynced", data } as SessionEvent);
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
    if (model.runner === null) return { model };
    return { model: { ...model, runner: { ...model.runner, now } } };
  },
  ChangedFieldValue: ({ taskFieldId, value }) =>
    applyPlan(model, { _tag: "FieldChanged", taskFieldId, value } as SessionEvent),
  AdjustedCounter: ({ taskFieldId, delta }) =>
    applyPlan(model, { _tag: "CounterAdjusted", taskFieldId, delta } as SessionEvent),
  ClickedRecord: () => applyPlan(model, { _tag: "RecordRequested" }),
  TaskRecorded: () => applyPlan(model, { _tag: "RecordAcked" }),
  ClickedEndSession: () => applyPlan(model, { _tag: "EndRequested" }),
  CanceledEndSession: () => applyPlan(model, { _tag: "EndCancelled" }),
  ConfirmedEndSession: () => applyPlan(model, { _tag: "EndConfirmed" }),
  SessionEnded: () => {
    const planned = applyPlan(model, { _tag: "EndAcked" });
    return {
      model: { ...planned.model, placeholderName: generateSessionName() },
      commands: [...(planned.commands ?? []), NavigateInternal({ url: "#/start" })],
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
