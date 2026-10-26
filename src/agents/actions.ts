import { Array, Match, Option, Schema, String } from "effect";
import { Port } from "foldkit";

import { Message } from "../messages";
import { RouteSchema, type Route } from "../web/routes";
import { FieldKind, type FieldDef } from "../domain/fields";
import { isScalarAnswerValid } from "../web/fields";
import { editableSection } from "../web/features/session/runner";
import type { Model } from "../main";
import { activeSessionOf, historyOf, templatesOf } from "../app/model";
import { AgentState } from "./state";

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
  Message.AdjustedCounter,
  Message.ClickedRecord,
  Message.ClickedEndSession,
  Message.ConfirmedEndSession,
  Message.CanceledEndSession,
  Message.ClickedSelectTask,
  Message.ClickedCancelEdit,
  Message.ClickedSaveEdit,
  Message.RequestedHistoryDelete,
  Message.CanceledHistoryDelete,
  Message.ConfirmedHistoryDelete,
  Message.ClickedHistoryRow,
  Message.ClickedEditHistoryName,
  Message.ChangedEditHistoryName,
  Message.ConfirmedEditHistoryName,
  Message.CanceledEditHistoryName,
  Message.ClickedExportHistoryCsv,
]);
export type AgentAction = typeof AgentAction.Type;

const routeError = (model: Model, route: Route): string | null =>
  RouteSchema.matchOrElse(
    route,
    {
      SessionRunner: ({ sessionId }) =>
        activeSessionOf(model)?.id === sessionId
          ? null
          : "Only the active session can be opened in the runner.",
      TemplateEditor: ({ templateId }) =>
        Array.some(templatesOf(model), (template) => template.id === templateId)
          ? null
          : "Template not found.",
      SessionDetail: ({ sessionId }) =>
        Array.some(historyOf(model), (session) => session.id === sessionId)
          ? null
          : "Archived session not found.",
    },
    () => null,
  );

const targetError = (model: Model, action: AgentAction): string | null =>
  Match.value(action).pipe(
    Match.tag(
      "ClickedSetDefaultTemplate",
      "ClickedDuplicateTemplate",
      "ClickedTemplateRow",
      "RequestedDeleteTemplate",
      "SelectedTemplate",
      ({ id }) =>
        Array.some(templatesOf(model), (template) => template.id === id)
          ? null
          : "Template not found.",
    ),
    Match.tag("RequestedHistoryDelete", "ClickedHistoryRow", ({ id }) =>
      Array.some(historyOf(model), (session) => session.id === id)
        ? null
        : "Archived session not found.",
    ),
    Match.tag("ClickedExportHistoryCsv", ({ sessionId }) =>
      Array.some(historyOf(model), (session) => session.id === sessionId)
        ? null
        : "Archived session not found.",
    ),
    Match.orElse(() => null),
  );

const checkboxValueError = (
  field: Pick<FieldDef, "options" | "exclusiveOptions">,
  value: string,
) => {
  if (value === "") return null;
  const selected = String.split(value, ",");
  if (
    Array.join(
      Array.filter(field.options, (option) => Array.contains(selected, option)),
      ",",
    ) !== value ||
    (selected.length > 1 &&
      Array.some(selected, (option) => Array.contains(field.exclusiveOptions, option)))
  )
    return "Use valid checkbox options in template order, respecting exclusive options.";
  return null;
};

/** Agents may only change the selected task, and only while it accepts changes. */
const selectedEditableSection = (model: Model, taskFieldId: string) => {
  const runner = model.runner;
  if (runner === null) return null;
  return Array.findFirst(runner.tasks, (candidate) => candidate.id === runner.currentTaskId).pipe(
    Option.match({
      onNone: () => null,
      onSome: (task) => editableSection({ tasks: [task] }, taskFieldId),
    }),
  );
};

const fieldValueError = (
  model: Model,
  action: Extract<AgentAction, { _tag: "ChangedFieldValue" }>,
): string | null => {
  const field = selectedEditableSection(model, action.taskFieldId);
  if (field === null) return "Select the task for editing before changing its fields.";
  if (field.kind === "radio" && !Schema.is(Schema.Literals(["", ...field.options]))(action.value))
    return "Choose a listed radio option.";
  if (!isScalarAnswerValid(field.kind, action.value))
    return "Use a valid answer: a number, a non-negative whole counter, a rating from 1 to 5, or true/false for Yes/No. Empty means unanswered.";
  if (field.kind === "checkbox") return checkboxValueError(field, action.value);
  return null;
};

const counterError = (model: Model, taskFieldId: string): string | null =>
  selectedEditableSection(model, taskFieldId)?.kind === "counter"
    ? null
    : "Select an editable counter first.";

/** UI controls normally constrain these values/IDs; an external caller must not bypass that. */
export const actionError = (model: Model, action: AgentAction): string | null =>
  Match.value(action).pipe(
    Match.tag("Navigate", ({ route }) => routeError(model, route)),
    Match.tag("ClickedStartSession", () =>
      activeSessionOf(model) === null
        ? null
        : "A session is already active. Resume or end it first.",
    ),
    Match.tag("ConfirmedDiscardSession", () =>
      model.pendingDiscardSession ? null : "Request session discard first.",
    ),
    Match.tag("ChangedFieldValue", (changed) => fieldValueError(model, changed)),
    Match.tag("AdjustedCounter", ({ taskFieldId }) => counterError(model, taskFieldId)),
    Match.orElse((other) => targetError(model, other)),
  );

export const AgentPortReply = Schema.Struct({
  requestId: Schema.String,
  // Internal port data; the connection validates and projects it before returning tool output.
  state: Schema.Unknown,
  error: Schema.NullOr(Schema.String),
});
export type AgentPortReply = typeof AgentPortReply.Type;

export const AgentResult = Schema.Struct({ state: AgentState });
export type AgentResult = typeof AgentResult.Type;

export const agentPorts = {
  inbound: {
    agentRequest: Port.inbound(
      Schema.Struct({
        requestId: Schema.String,
        action: Schema.Unknown,
        confirmationVersion: Schema.optionalKey(Schema.Finite),
      }),
    ),
  },
  outbound: { agentReply: Port.outbound(AgentPortReply) },
};

type ConfirmationTarget = { readonly id: string; readonly name: string };

/**
 * Destructive agent confirmation policy. Add confirmed actions here so prompting,
 * target snapshots, stale-approval checks, and UI-originated invalidation stay aligned.
 */
const confirmedActions = [
  {
    tag: "ConfirmedDeleteTemplate",
    label: "permanently delete the template",
    target: (model: Model) => model.pendingDelete,
    // Re-requesting the same target must also invalidate an approval (A→A and A→B→A).
    invalidatedBy: ["RequestedDeleteTemplate"],
  },
  {
    tag: "ConfirmedHistoryDelete",
    label: "permanently delete the recorded session",
    target: (model: Model) =>
      model.pendingHistoryDelete && {
        id: model.pendingHistoryDelete.id,
        name: model.pendingHistoryDelete.displayName,
      },
    invalidatedBy: ["RequestedHistoryDelete"],
  },
  {
    tag: "ConfirmedDiscardSession",
    label: "discard the live session and its recordings",
    target: (model: Model) => {
      const active = activeSessionOf(model);
      return model.pendingDiscardSession && active !== null
        ? { id: active.id, name: active.sessionName }
        : null;
    },
    invalidatedBy: [],
  },
  {
    tag: "ConfirmedEndSession",
    label: "end recording the live session",
    target: (model: Model) =>
      model.runner?.showEndConfirm === true
        ? { id: model.runner.sessionId, name: model.runner.sessionName }
        : null,
    invalidatedBy: [],
  },
  {
    tag: "ConfirmedDiscard",
    label: "discard unsaved template changes",
    target: (model: Model) =>
      model.editor?.pendingDiscard === true
        ? { id: model.editor.id, name: model.editor.name, draft: model.editor }
        : null,
    invalidatedBy: [],
  },
] as const satisfies ReadonlyArray<{
  tag: AgentAction["_tag"];
  label: string;
  target: (model: Model) => ConfirmationTarget | null;
  invalidatedBy: ReadonlyArray<AgentAction["_tag"]>;
}>;

export const requiresConfirmation = (action: AgentAction) =>
  Array.some(confirmedActions, ({ tag }) => tag === action._tag);

/** Shared by the prompt and the atomic update-loop consent check. */
export const confirmationTarget = (model: Model, action: AgentAction) =>
  Array.findFirst(confirmedActions, ({ tag }) => tag === action._tag).pipe(
    Option.match({ onNone: () => null, onSome: (metadata) => metadata.target(model) }),
  );

/** Plain-language description of a confirmed action for the browser prompt. */
export const confirmationLabel = (action: AgentAction) =>
  Array.findFirst(confirmedActions, ({ tag }) => tag === action._tag).pipe(
    Option.match({ onNone: () => action._tag, onSome: ({ label }) => label }),
  );

const sameTarget = (
  a: (ConfirmationTarget & { readonly draft?: unknown }) | null | false,
  b: (ConfirmationTarget & { readonly draft?: unknown }) | null | false,
) =>
  a === b ||
  (a !== null &&
    a !== false &&
    b !== null &&
    b !== false &&
    a.id === b.id &&
    a.name === b.name &&
    // Models are immutable, so an unchanged draft keeps its reference.
    a.draft === b.draft);

/** Whether any destructive confirmation target differs between two models. */
export const confirmationChanged = (before: Model, after: Model) =>
  Array.some(confirmedActions, ({ target }) => !sameTarget(target(before), target(after)));

/** Events that consume approval even when their resulting target snapshot is unchanged. */
export const invalidatesAgentConfirmation = (action: { readonly _tag: string }) =>
  Array.some(
    confirmedActions,
    ({ tag, invalidatedBy }) =>
      tag === action._tag ||
      Array.some(invalidatedBy, (invalidator: string) => invalidator === action._tag),
  );
