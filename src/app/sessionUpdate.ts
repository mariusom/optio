import { String } from "effect";
import { DiscardLiveSession, StartSession } from "../web/features/session/startCommands";
import { resolveSelectedTemplate } from "../web/features/session/startHelpers";
import { hrefFor, SessionRunner } from "../web/routes";
import { currentTask } from "../web/features/session/runner";
import { GeneratePlaceholderName, NavigateInternal, applyPlan } from "./commands";
import type { MessageHandlers, UpdateResult } from "../messages";
import * as AsyncData from "@/lib/asyncData";
import { activeSessionOf, takeId, templatesOf, type Model } from "./model";

type Result = UpdateResult<Model>;
type AllHandlers = MessageHandlers<Result>;

type SessionHandlers = Pick<
  AllHandlers,
  | "GotActiveSession"
  | "ChangedSessionNameInput"
  | "CompletedGeneratePlaceholderName"
  | "SelectedTemplate"
  | "ClickedStartSession"
  | "SucceededStartSession"
  | "DismissedJoinedSession"
  | "ClickedResumeSession"
  | "ClickedDiscardSession"
  | "CanceledDiscardSession"
  | "ConfirmedDiscardSession"
  | "SucceededDiscardLiveSession"
  | "FailedSessionOp"
  | "GotRunnerData"
  | "Ticked"
  | "ChangedFieldValue"
  | "SettledFieldInput"
  | "BlurredField"
  | "AdjustedCounter"
  | "ClickedRecord"
  | "PressedPrimaryShortcut"
  | "SucceededRecordTask"
  | "CompletedVibrateRecorded"
  | "ClickedEndSession"
  | "CanceledEndSession"
  | "ConfirmedEndSession"
  | "SucceededEndSession"
  | "ClickedSelectTask"
  | "ToggledTaskList"
  | "FocusedSection"
  | "ClickedCancelEdit"
  | "ClickedSaveEdit"
  | "TaskEditStarted"
  | "SucceededUpdateFieldValues"
  | "SucceededAdjustCounter"
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
  CompletedGeneratePlaceholderName: ({ name }) => ({ model: { ...model, placeholderName: name } }),
  SelectedTemplate: ({ id }) => ({ model: { ...model, selectedTemplateId: id } }),
  ClickedStartSession: () => {
    const selected = resolveSelectedTemplate(templatesOf(model), model.selectedTemplateId);
    if (selected === null) return { model };
    const trimmedName = String.trim(model.sessionNameInput);
    const sessionName = trimmedName !== "" ? trimmedName : model.placeholderName;
    const [id, next] = takeId(model);
    // Pass empty fields array; StartSession will resolve via store fallback
    return {
      model: next,
      commands: [
        StartSession.make({
          id,
          templateId: selected.id,
          templateName: selected.name,
          sessionName,
          fields: [],
        }),
      ],
    };
  },
  // A session already live in another tab is joined instead, and the runner
  // says so; the name typed for the new session is kept for later.
  SucceededStartSession: ({ sessionId, joinedExisting }) => ({
    model: {
      ...model,
      sessionNameInput: joinedExisting ? model.sessionNameInput : "",
      lastError: null,
      joinedExistingSession: joinedExisting,
    },
    commands: [
      GeneratePlaceholderName.make({}),
      NavigateInternal.make({ url: hrefFor(SessionRunner({ sessionId })) }),
    ],
  }),
  DismissedJoinedSession: () => ({ model: { ...model, joinedExistingSession: false } }),
  ClickedResumeSession: () => {
    const active = activeSessionOf(model);
    if (active === null) return { model };
    return {
      model,
      commands: [
        NavigateInternal.make({
          url: hrefFor(SessionRunner({ sessionId: active.id })),
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
      commands: [DiscardLiveSession.make({ sessionId: active.id })],
    };
  },
  SucceededDiscardLiveSession: () => ({
    model: {
      ...model,
      activeSession: AsyncData.succeed(null),
      pendingDiscardSession: false,
      lastError: null,
    },
    commands: [GeneratePlaceholderName.make({})],
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
        commands: [...(planned.commands ?? []), NavigateInternal.make({ url: "#/start" })],
      };
    }
    return planned;
  },
  Ticked: ({ now }) => {
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
  // Same plan as the visible primary button: Save while editing, else Record.
  PressedPrimaryShortcut: () =>
    applyPlan(model, {
      _tag:
        model.runner !== null && currentTask(model.runner)?.isBeingEdited === true
          ? "EditSaved"
          : "RecordRequested",
    }),
  SucceededRecordTask: ({ taskId, fresh }) =>
    applyPlan(model, { _tag: "RecordAcked", taskId, fresh }),
  CompletedVibrateRecorded: () => ({ model }),
  ClickedEndSession: () => applyPlan(model, { _tag: "EndRequested" }),
  CanceledEndSession: () => applyPlan(model, { _tag: "EndCancelled" }),
  ConfirmedEndSession: () => applyPlan(model, { _tag: "EndConfirmed" }),
  SucceededEndSession: () => {
    const planned = applyPlan(model, { _tag: "EndAcked" });
    return {
      model: planned.model,
      commands: [
        ...(planned.commands ?? []),
        GeneratePlaceholderName.make({}),
        NavigateInternal.make({ url: "#/start" }),
      ],
    };
  },
  ClickedSelectTask: ({ taskId }) => applyPlan(model, { _tag: "TaskSelected", taskId }),
  ToggledTaskList: () => applyPlan(model, { _tag: "TaskListToggled" }),
  FocusedSection: ({ fieldId }) => applyPlan(model, { _tag: "SectionFocused", fieldId }),
  ClickedCancelEdit: () => applyPlan(model, { _tag: "EditCancelled" }),
  ClickedSaveEdit: () => applyPlan(model, { _tag: "EditSaved" }),
  TaskEditStarted: () => ({ model }),
  SucceededUpdateFieldValues: () => ({ model }),
  SucceededAdjustCounter: () => ({ model }),
  TaskEditFinished: ({ savedTaskId }) => applyPlan(model, { _tag: "EditAcked", savedTaskId }),
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
