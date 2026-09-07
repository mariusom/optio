import { Schema } from "effect";
import { Port } from "foldkit";

import { Message } from "../messages";
import { RouteSchema } from "../we/routes";
import { FieldKind } from "../livestore/schema";
import type { Model } from "../main";

// Only user operations: never allow fabricated store snapshots, completion
// messages, arbitrary URLs, or recursive agent requests into the update loop.
export const AgentAction = Schema.Union([
  Schema.TaggedStruct("Navigate", { route: RouteSchema }),
  Message.SelectedTheme,
  Message.ClickedNewTemplate,
  Message.ChangedNewName,
  Message.ConfirmedCreateTemplate,
  Message.CanceledCreateTemplate,
  Message.ClickedTemplateRow,
  Message.ClickedSetDefaultTemplate,
  Message.ClickedDuplicateTemplate,
  Message.RequestedDeleteTemplate,
  Message.CanceledDeleteTemplate,
  Message.ConfirmedDeleteTemplate,
  Message.ChangedEditorName,
  Message.ToggledEditorDefault,
  Message.ClickedAddField,
  Message.CanceledAddField,
  Message.ClickedEditField,
  Message.ChangedFieldName,
  Schema.TaggedStruct("ChangedFieldKind", { kind: FieldKind }),
  Message.ToggledFieldRequired,
  Message.ChangedFieldDefaultValue,
  Message.ToggledFieldDefaultBoolean,
  Message.ChangedNewOptionText,
  Message.ConfirmedAddOption,
  Schema.TaggedStruct("ClickedDeleteOption", {
    index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  Schema.TaggedStruct("ToggledExclusiveOption", {
    index: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
  Message.ClickedDeleteField,
  Message.ClickedMoveFieldUp,
  Message.ClickedMoveFieldDown,
  Message.ConfirmedSaveField,
  Message.ClickedSaveTemplate,
  Message.ClickedCancelEditTemplate,
  Message.ShowDiscardConfirm,
  Message.CanceledDiscard,
  Message.ConfirmedDiscard,
  Message.ChangedSessionNameInput,
  Message.SelectedTemplate,
  Message.ClickedStartSession,
  Message.ClickedResumeSession,
  Message.ClickedDiscardSession,
  Message.ConfirmedDiscardSession,
  Message.CanceledDiscardSession,
  Message.ChangedFieldValue,
  Message.ClickedRecord,
  Message.ClickedEndSession,
  Message.ConfirmedEndSession,
  Message.CanceledEndSession,
  Message.ClickedSelectTask,
  Message.ClickedCancelEdit,
  Message.ClickedSaveEdit,
  Message.ToggledTaskList,
  Message.ToggledSidebar,
  Message.FocusedSection,
  Message.DismissedRunnerError,
  Message.RequestedHistoryDelete,
  Message.CanceledHistoryDelete,
  Message.ConfirmedHistoryDelete,
  Message.ClickedHistoryRow,
  Message.ClickedEditHistoryName,
  Message.ChangedEditHistoryName,
  Message.ConfirmedEditHistoryName,
  Message.CanceledEditHistoryName,
  Message.ClickedHistoryTask,
  Message.DismissedHistoryTask,
  Message.ClickedExportHistoryCsv,
  Message.DismissedCsvError,
]);
export type AgentAction = typeof AgentAction.Type;

/** UI controls normally constrain these values/IDs; an external caller must not bypass that. */
export const actionError = (model: Model, action: AgentAction): string | null => {
  switch (action._tag) {
    case "Navigate": {
      const route = action.route;
      switch (route._tag) {
        case "SessionRunner":
          return model.activeSession?.id === route.sessionId
            ? null
            : "Only the active session can be opened in the runner.";
        case "TemplateEditor":
          return model.templates.some((template) => template.id === route.templateId)
            ? null
            : "Template not found.";
        case "SessionDetail":
          return model.history.some((session) => session.id === route.sessionId)
            ? null
            : "Archived session not found.";
        default:
          return null;
      }
    }
    case "ClickedStartSession":
      return model.activeSession === null
        ? null
        : "A session is already active. Resume or end it first.";
    case "ClickedSetDefaultTemplate":
    case "ClickedDuplicateTemplate":
    case "ClickedTemplateRow":
    case "RequestedDeleteTemplate":
    case "SelectedTemplate":
      return model.templates.some((template) => template.id === action.id)
        ? null
        : "Template not found.";
    case "RequestedHistoryDelete":
    case "ClickedHistoryRow":
      return model.history.some((session) => session.id === action.id)
        ? null
        : "Archived session not found.";
    case "ClickedExportHistoryCsv":
      return model.history.some((session) => session.id === action.sessionId)
        ? null
        : "Archived session not found.";
    case "ConfirmedDiscardSession":
      return model.pendingDiscardSession ? null : "Request session discard first.";
    case "ChangedFieldValue": {
      const task = model.runner?.tasks.find((task) => task.id === model.runner?.currentTaskId);
      const field = task?.sections.find((field) => field.id === action.taskFieldId);
      if (!field || (task?.endDate !== null && !task?.isBeingEdited))
        return "Select the task for editing before changing its fields.";
      if (
        field.kind === "radio" &&
        !Schema.is(Schema.Literals(["", ...field.options]))(action.value)
      )
        return "Choose a listed radio option.";
      if (field.kind === "boolean" && !Schema.is(Schema.Literals(["true", "false"]))(action.value))
        return "Toggle values must be true or false.";
      if (field.kind === "checkbox" && action.value !== "") {
        const selected = action.value.split(",");
        if (
          field.options.filter((option) => selected.includes(option)).join(",") !== action.value ||
          (selected.length > 1 &&
            selected.some((option) => field.exclusiveOptions.includes(option)))
        )
          return "Use valid checkbox options in template order, respecting exclusive options.";
      }
      return null;
    }
    default:
      return null;
  }
};

export const AgentReply = Schema.Struct({
  requestId: Schema.String,
  // The complete current application model is JSON data, including loaded field values.
  state: Schema.Unknown,
  changed: Schema.Boolean,
  pendingCommands: Schema.Number,
  error: Schema.NullOr(Schema.String),
});
export type AgentReply = typeof AgentReply.Type;

export const agentPorts = {
  inbound: {
    agentRequest: Port.inbound(
      Schema.Struct({
        requestId: Schema.String,
        action: Schema.Unknown,
        confirmationVersion: Schema.optionalKey(Schema.Number),
      }),
    ),
  },
  outbound: { agentReply: Port.outbound(AgentReply) },
};

export const requiresConfirmation = (action: AgentAction) =>
  [
    "ConfirmedDeleteTemplate",
    "ConfirmedDiscard",
    "ConfirmedDiscardSession",
    "ConfirmedHistoryDelete",
    "ConfirmedEndSession",
  ].includes(action._tag);

/** Shared by the prompt and the atomic update-loop consent check. */
export const confirmationTarget = (model: Model, action: AgentAction) => {
  switch (action._tag) {
    case "ConfirmedDeleteTemplate":
      return model.pendingDelete;
    case "ConfirmedHistoryDelete":
      return (
        model.pendingHistoryDelete && {
          id: model.pendingHistoryDelete.id,
          name: model.pendingHistoryDelete.displayName,
        }
      );
    case "ConfirmedDiscardSession":
      return model.pendingDiscardSession && model.activeSession
        ? { id: model.activeSession.id, name: model.activeSession.sessionName }
        : null;
    case "ConfirmedEndSession":
      return model.runner?.showEndConfirm
        ? { id: model.runner.sessionId, name: model.runner.sessionName }
        : null;
    case "ConfirmedDiscard":
      return model.editor?.pendingDiscard
        ? { id: model.editor.id, name: model.editor.name, draft: model.editor }
        : null;
    default:
      return null;
  }
};

export const confirmationState = (model: Model) =>
  JSON.stringify([
    confirmationTarget(model, { _tag: "ConfirmedDeleteTemplate" }),
    confirmationTarget(model, { _tag: "ConfirmedHistoryDelete" }),
    confirmationTarget(model, { _tag: "ConfirmedDiscardSession" }),
    confirmationTarget(model, { _tag: "ConfirmedEndSession" }),
    confirmationTarget(model, { _tag: "ConfirmedDiscard" }),
  ]);
