import { Schema } from "effect";

import type { Model } from "../main";
import { FieldDef, FieldKind } from "../livestore/schema";
import { RunnerDataSchema } from "../we/features/session/runner";
import { RouteSchema } from "../we/routes";
import { Theme } from "../we/theme";
import { TemplateSummary } from "../we/types";

const TemplateEditor = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  fields: Schema.Array(FieldDef),
  isSaving: Schema.Boolean,
  showAddField: Schema.Boolean,
  editingFieldId: Schema.NullOr(Schema.String),
  draft: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      kind: FieldKind,
      isRequired: Schema.Boolean,
      defaultValue: Schema.String,
      sortOrder: Schema.Number,
      options: Schema.Array(Schema.String),
      exclusiveOptions: Schema.Array(Schema.String),
      newOptionText: Schema.String,
    }),
  ),
  pendingDiscard: Schema.Boolean,
});

const ActiveSession = Schema.Struct({
  id: Schema.String,
  templateId: Schema.NullOr(Schema.String),
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  completedCount: Schema.Number,
});

const AgentRunner = Schema.Struct({
  ...RunnerDataSchema.fields,
  showEndConfirm: Schema.Boolean,
  lastError: Schema.NullOr(Schema.String),
});

const HistorySummary = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  templateName: Schema.String,
  sessionName: Schema.String,
  startedAt: Schema.Number,
  endedAt: Schema.Number,
  taskCount: Schema.Number,
});

const HistoryDetail = Schema.Struct({
  id: Schema.String,
  sessionName: Schema.String,
  templateName: Schema.String,
  startedAt: Schema.Number,
  endedAt: Schema.NullOr(Schema.Number),
  taskCount: Schema.Number,
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      taskId: Schema.Number,
      startedAt: Schema.NullOr(Schema.Number),
      endedAt: Schema.NullOr(Schema.Number),
      sections: Schema.Array(
        Schema.Struct({
          sectionName: Schema.String,
          value: Schema.String,
          sectionType: Schema.String,
          isRequired: Schema.Boolean,
          startedAt: Schema.NullOr(Schema.Number),
        }),
      ),
    }),
  ),
});

/** Stable, explicit state exposed to assistants. Visual and authorization internals stay private. */
export const AgentState = Schema.Struct({
  route: RouteSchema,
  theme: Theme,
  templates: Schema.Array(TemplateSummary),
  showCreate: Schema.Boolean,
  newName: Schema.String,
  pendingDelete: Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String })),
  lastError: Schema.NullOr(Schema.String),
  editor: Schema.NullOr(TemplateEditor),
  selectedTemplateId: Schema.NullOr(Schema.String),
  sessionNameInput: Schema.String,
  placeholderName: Schema.String,
  activeSession: Schema.NullOr(ActiveSession),
  pendingDiscardSession: Schema.Boolean,
  runner: Schema.NullOr(AgentRunner),
  history: Schema.Array(HistorySummary),
  selectedHistorySession: Schema.NullOr(HistoryDetail),
  pendingHistoryDelete: Schema.NullOr(
    Schema.Struct({ id: Schema.String, displayName: Schema.String }),
  ),
  showEditHistoryName: Schema.Boolean,
  editHistoryNameInput: Schema.String,
  pendingNavigationUrl: Schema.NullOr(Schema.String),
  csvError: Schema.NullOr(Schema.String),
});
export type AgentState = typeof AgentState.Type;

export const projectAgentState = (model: Model): AgentState => {
  const editor =
    model.editor === null
      ? null
      : {
          id: model.editor.id,
          name: model.editor.name,
          isDefault: model.editor.isDefault,
          fields: model.editor.fields,
          isSaving: model.editor.isSaving,
          showAddField: model.editor.showAddField,
          editingFieldId: model.editor.editingFieldId,
          draft: model.editor.draft,
          pendingDiscard: model.editor.pendingDiscard,
        };
  const runner =
    model.runner === null
      ? null
      : {
          sessionId: model.runner.sessionId,
          templateName: model.runner.templateName,
          sessionName: model.runner.sessionName,
          startedAt: model.runner.startedAt,
          tasks: model.runner.tasks,
          currentTaskId: model.runner.currentTaskId,
          completedCount: model.runner.completedCount,
          showEndConfirm: model.runner.showEndConfirm,
          lastError: model.runner.lastError,
        };
  return {
    route: model.route,
    theme: model.theme,
    templates: model.templates,
    showCreate: model.showCreate,
    newName: model.newName,
    pendingDelete: model.pendingDelete,
    lastError: model.lastError,
    editor,
    selectedTemplateId: model.selectedTemplateId,
    sessionNameInput: model.sessionNameInput,
    placeholderName: model.placeholderName,
    activeSession: model.activeSession,
    pendingDiscardSession: model.pendingDiscardSession,
    runner,
    history: model.history,
    selectedHistorySession: model.selectedHistorySession,
    pendingHistoryDelete: model.pendingHistoryDelete,
    showEditHistoryName: model.showEditHistoryName,
    editHistoryNameInput: model.editHistoryNameInput,
    pendingNavigationUrl: model.pendingNavigationUrl,
    csvError: model.csvError,
  };
};
