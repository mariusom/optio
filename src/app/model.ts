import { Schema as S } from "effect";
import { FieldDef, FieldKind } from "../livestore/schema";
import { RunnerStateSchema } from "../web/features/session/runner";
import { RouteSchema, type Route } from "../web/routes";
import { Accent, Font, IconLibrary, Theme } from "../web/theme";
import { FoldcnStyle } from "../web/style";
import { generateSessionName } from "../web/random-name";

export const Model = S.Struct({
  agentConfirmationVersion: S.Number,
  route: RouteSchema,
  theme: Theme,
  themeSaveFailed: S.Boolean,
  style: FoldcnStyle,
  styleSaveFailed: S.Boolean,
  styleLoadFailed: S.Boolean,
  font: Font,
  fontSaveFailed: S.Boolean,
  iconLibrary: IconLibrary,
  iconLibrarySaveFailed: S.Boolean,
  accent: Accent,
  accentSaveFailed: S.Boolean,
  accentDraft: S.NullOr(S.String),
  // Templates tab slice
  templates: S.Array(
    S.Struct({
      id: S.String,
      name: S.String,
      isDefault: S.Boolean,
      createdAt: S.Number,
      updatedAt: S.Number,
      fieldCount: S.Number,
      requiredCount: S.Number,
    }),
  ),
  showCreate: S.Boolean,
  newName: S.String,
  pendingDelete: S.Union([S.Null, S.Struct({ id: S.String, name: S.String })]),
  /** Template whose "⋯" action sheet is open, if any. */
  templateActionsFor: S.Union([S.Null, S.String]),
  lastError: S.Union([S.Null, S.String]),
  editor: S.Union([
    S.Null,
    S.Struct({
      id: S.String,
      name: S.String,
      isDefault: S.Boolean,
      fields: S.Array(FieldDef),
      original: S.Struct({
        name: S.String,
        isDefault: S.Boolean,
        fields: S.Array(FieldDef),
      }),
      isSaving: S.Boolean,
      showAddField: S.Boolean,
      editingFieldId: S.Union([S.Null, S.String]),
      draft: S.Union([
        S.Null,
        S.Struct({
          id: S.String,
          name: S.String,
          kind: FieldKind,
          isRequired: S.Boolean,
          defaultValue: S.String,
          sortOrder: S.Number,
          options: S.Array(S.String),
          exclusiveOptions: S.Array(S.String),
          newOptionText: S.String,
        }),
      ]),
      pendingDiscard: S.Boolean,
    }),
  ]),
  // Session launcher
  selectedTemplateId: S.Union([S.Null, S.String]),
  sessionNameInput: S.String,
  placeholderName: S.String,
  activeSession: S.Union([
    S.Null,
    S.Struct({
      id: S.String,
      templateId: S.Union([S.Null, S.String]),
      templateName: S.String,
      sessionName: S.String,
      startedAt: S.Number,
      completedCount: S.Number,
    }),
  ]),
  pendingDiscardSession: S.Boolean,
  // Live session form
  runner: S.Union([S.Null, RunnerStateSchema]),
  // Machine phase for the live Session statechart (Idle ⇔ runner === null)
  runnerPhase: S.Union([S.Literal("collecting"), S.Literal("confirming")]),
  // Archived sessions
  history: S.Array(
    S.Struct({
      id: S.String,
      displayName: S.String,
      templateName: S.String,
      sessionName: S.String,
      startedAt: S.Number,
      endedAt: S.Number,
      taskCount: S.Number,
    }),
  ),
  selectedHistorySession: S.Union([
    S.Null,
    S.Struct({
      id: S.String,
      sessionName: S.String,
      templateName: S.String,
      startedAt: S.Number,
      endedAt: S.Union([S.Null, S.Number]),
      taskCount: S.Number,
      tasks: S.Array(
        S.Struct({
          id: S.String,
          taskId: S.Number,
          startedAt: S.Union([S.Null, S.Number]),
          endedAt: S.Union([S.Null, S.Number]),
          sections: S.Array(
            S.Struct({
              sectionName: S.String,
              value: S.String,
              sectionType: S.String,
              isRequired: S.Boolean,
              startedAt: S.Union([S.Null, S.Number]),
            }),
          ),
        }),
      ),
    }),
  ]),
  pendingHistoryDelete: S.Union([S.Null, S.Struct({ id: S.String, displayName: S.String })]),
  showEditHistoryName: S.Boolean,
  editHistoryNameInput: S.String,
  selectedHistoryTaskId: S.Union([S.Null, S.String]),
  historyActionsFor: S.Union([S.Null, S.String]),
  /** Where an internal link wanted to go while the editor had unsaved changes. */
  pendingNavigationUrl: S.Union([S.Null, S.String]),
  csvError: S.Union([S.Null, S.String]),
  promptCopyStatus: S.Literals(["idle", "copying", "copied", "failed"]),
});
export type Model = typeof Model.Type;

const initialModel = (route: Route): Model => ({
  agentConfirmationVersion: 0,
  route,
  theme: "auto",
  themeSaveFailed: false,
  style: "nova",
  styleSaveFailed: false,
  styleLoadFailed: false,
  font: "sans",
  fontSaveFailed: false,
  iconLibrary: "hugeicons",
  iconLibrarySaveFailed: false,
  accent: "default",
  accentSaveFailed: false,
  accentDraft: null,
  templates: [],
  showCreate: false,
  newName: "",
  pendingDelete: null,
  templateActionsFor: null,
  lastError: null,
  editor: null,
  selectedTemplateId: null,
  sessionNameInput: "",
  placeholderName: generateSessionName(),
  activeSession: null,
  pendingDiscardSession: false,
  runner: null,
  runnerPhase: "collecting",
  history: [],
  selectedHistorySession: null,
  pendingHistoryDelete: null,
  showEditHistoryName: false,
  editHistoryNameInput: "",
  selectedHistoryTaskId: null,
  historyActionsFor: null,
  pendingNavigationUrl: null,
  csvError: null,
  promptCopyStatus: "idle",
});

export { initialModel };
