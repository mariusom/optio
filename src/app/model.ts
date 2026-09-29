import { Schema as S } from "effect";
import { FieldDef, FieldKind } from "../domain/fields";
import { RunnerStateSchema } from "../web/features/session/runner";
import { RouteSchema, type Route } from "../web/routes";
import { Accent, Font, IconLibrary, Theme } from "../web/theme";
import { FoldcnStyle } from "../web/style";

// Payload shapes shared by the Model and the Messages that deliver them.

/** The open session shown on the Start tab. */
export const ActiveSessionSummary = S.Struct({
  id: S.String,
  templateId: S.Union([S.Null, S.String]),
  templateName: S.String,
  sessionName: S.String,
  startedAt: S.Number,
  completedCount: S.Number,
});

/** One archived session in the History list. */
export const HistorySessionSummary = S.Struct({
  id: S.String,
  displayName: S.String,
  templateName: S.String,
  sessionName: S.String,
  startedAt: S.Number,
  endedAt: S.Number,
  taskCount: S.Number,
});

/** An archived session with its tasks and answers. */
export const HistorySessionDetail = S.Struct({
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
});

export const Model = S.Struct({
  agentConfirmationVersion: S.Number,
  route: RouteSchema,
  /**
   * Latest wall-clock time (ms), filled by the runtime boot and the ticker
   * subscription from Effect's Clock. Views and update read time from here,
   * never the clock, so rendering stays a function of the Model.
   */
  now: S.Number,
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
  activeSession: S.NullOr(ActiveSessionSummary),
  pendingDiscardSession: S.Boolean,
  // Live session form
  runner: S.Union([S.Null, RunnerStateSchema]),
  // Archived sessions
  history: S.Array(HistorySessionSummary),
  selectedHistorySession: S.NullOr(HistorySessionDetail),
  /**
   * The open session detail or template editor could not be read. Without it a
   * null detail means "still opening"; a missing item navigates away instead.
   */
  detailLoadFailed: S.Boolean,
  pendingHistoryDelete: S.Union([S.Null, S.Struct({ id: S.String, displayName: S.String })]),
  showEditHistoryName: S.Boolean,
  editHistoryNameInput: S.String,
  selectedHistoryTaskId: S.Union([S.Null, S.String]),
  historyActionsFor: S.Union([S.Null, S.String]),
  /** Where an internal link wanted to go while the editor had unsaved changes. */
  pendingNavigationUrl: S.Union([S.Null, S.String]),
  /** Failed history delete, rename or export. */
  historyError: S.Union([S.Null, S.String]),
  /** Whether studies persist, live only in memory, or cannot be opened. */
  storage: S.Literals(["opening", "persisted", "in-memory", "unavailable"]),
  memoryStorageAcknowledged: S.Boolean,
  promptCopyStatus: S.Literals(["idle", "copying", "copied", "failed"]),
});
export type Model = typeof Model.Type;

const initialModel = (route: Route): Model => ({
  agentConfirmationVersion: 0,
  route,
  // Placeholder: the runtime boot fills this from Effect's Clock before the
  // first render, and the ticker keeps it fresh after.
  now: 0,
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
  // Filled by the GeneratePlaceholderName command that init issues.
  placeholderName: "",
  activeSession: null,
  pendingDiscardSession: false,
  runner: null,
  history: [],
  selectedHistorySession: null,
  detailLoadFailed: false,
  pendingHistoryDelete: null,
  showEditHistoryName: false,
  editHistoryNameInput: "",
  selectedHistoryTaskId: null,
  historyActionsFor: null,
  pendingNavigationUrl: null,
  historyError: null,
  storage: "opening",
  memoryStorageAcknowledged: false,
  promptCopyStatus: "idle",
});

export { initialModel };
