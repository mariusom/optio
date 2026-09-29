import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";

import { FieldDef } from "./domain/fields";
import { RouteSchema } from "./web/routes";
import { TemplateSummary } from "./web/types";
import { Accent, Font, IconLibrary, Theme } from "./web/theme";
import { FoldcnStyle } from "./web/style";
import { RunnerDataSchema } from "./web/features/session/runner";
import { ActiveSessionSummary, HistorySessionDetail, HistorySessionSummary } from "./app/model";

// Central flat Message union. Payload schemas are grouped by feature;
// root-model handlers are composed by src/app/update.ts.

export const Message = defineMessageUnion({
  AgentRequest: {
    requestId: S.String,
    action: S.Unknown,
    confirmationVersion: S.optionalKey(S.Number),
  },
  // ── Storage ────────────────────────────────────────────────────────────
  StoreOpened: { storageMode: S.Literals(["persisted", "in-memory"]) },
  StoreUnavailable: {},
  ClickedRetryStore: {},
  AcknowledgedMemoryStorage: {},

  // ── Routing ────────────────────────────────────────────────────────────
  GotRoute: { route: RouteSchema },
  ClickedLink: { request: UrlRequest },
  Navigated: {},
  CompletedReplyToAgent: {},
  /** A sheet was shown or released; the page model already owns whether it is open. */
  SettledSheet: {},
  SelectedTheme: { theme: Theme },
  ThemeSaveFinished: { theme: Theme, saved: S.Boolean },
  SelectedStyle: { style: FoldcnStyle },
  /** A newer style selection replaced this one before its styles loaded. */
  SupersededStyleSave: {},
  StyleSaveFinished: {
    style: FoldcnStyle,
    appliedStyle: FoldcnStyle,
    saved: S.Boolean,
    loadFailed: S.Boolean,
  },
  SelectedFont: { font: Font },
  FontSaveFinished: { font: Font, saved: S.Boolean },
  SelectedIconLibrary: { library: IconLibrary },
  IconLibrarySaveFinished: { library: IconLibrary, saved: S.Boolean },
  SelectedAccent: { accent: Accent },
  AccentSaveFinished: { accent: Accent, saved: S.Boolean },
  OpenedAccentPicker: {},
  ChangedAccentDraft: { colour: S.String },
  ConfirmedAccentPicker: {},
  CanceledAccentPicker: {},
  ClickedCopyTemplatePrompt: {},
  TemplatePromptCopyFinished: { copied: S.Boolean },
  ResetTemplatePromptCopy: {},

  // ── Templates ──────────────────────────────────────────────────────────
  GotTemplates: { templates: S.Array(TemplateSummary) },
  ClickedNewTemplate: {},
  ChangedNewName: { text: S.String },
  ConfirmedCreateTemplate: {},
  CanceledCreateTemplate: {},
  TemplateCreated: {},
  ClickedTemplateRow: { id: S.String },
  ClickedSetDefaultTemplate: { id: S.String },
  ClickedDuplicateTemplate: { id: S.String },
  DuplicatedTemplate: { id: S.String },
  RequestedDeleteTemplate: { id: S.String, name: S.String },
  CanceledDeleteTemplate: {},
  ConfirmedDeleteTemplate: {},
  TemplateOpDone: {},
  FailedTemplateOp: { error: S.String },
  TemplatesSeededCheck: {},
  OpenedTemplateActions: { id: S.String },
  ClosedTemplateActions: {},
  ClickedAddSampleTemplates: {},
  SampleTemplatesAdded: {},

  // ── Template editor ─────────────────────────────────────────────────────
  GotTemplateDetail: {
    template: S.Union([
      S.Null,
      S.Struct({ id: S.String, name: S.String, isDefault: S.Boolean, fields: S.Array(FieldDef) }),
    ]),
  },
  ChangedEditorName: { text: S.String },
  ToggledEditorDefault: {},
  ClickedAddField: {},
  CanceledAddField: {},
  ClickedBackFromField: {},
  ClickedEditField: { id: S.String },
  ChangedFieldName: { text: S.String },
  ChangedFieldKind: { kind: S.String },
  ToggledFieldRequired: {},
  ChangedFieldDefaultValue: { text: S.String },
  ToggledFieldDefaultBoolean: {},
  ChangedNewOptionText: { text: S.String },
  ConfirmedAddOption: {},
  ClickedDeleteOption: { index: S.Number },
  ClickedMoveOption: { index: S.Int, direction: S.Literals([-1, 1]) },
  ToggledExclusiveOption: { index: S.Number },
  ClickedDeleteField: { id: S.String },
  ClickedMoveFieldUp: { id: S.String },
  ClickedMoveFieldDown: { id: S.String },
  ConfirmedSaveField: {},
  ClickedSaveTemplate: {},
  ClickedCancelEditTemplate: {},
  TemplateSaved: {},
  ShowDiscardConfirm: {},
  CanceledDiscard: {},
  ConfirmedDiscard: {},

  // ── Start tab (Session start / Resume / Discard) ──────────────────────────
  ChangedSessionNameInput: { text: S.String },
  GotPlaceholderName: { name: S.String },
  SelectedTemplate: { id: S.String },
  ClickedStartSession: {},
  SessionStarted: { sessionId: S.String },
  ClickedResumeSession: {},
  ClickedDiscardSession: {},
  ConfirmedDiscardSession: {},
  CanceledDiscardSession: {},
  SessionDiscarded: {},
  GotActiveSession: { activeSession: S.NullOr(ActiveSessionSummary) },
  FailedSessionOp: { error: S.String },
  FailedDetailLoad: {},

  // ── Runner (live session form canvas) ─────────────────────────────────────
  GotRunnerData: {
    data: S.Union([S.Null, RunnerDataSchema]),
  },
  Tick: { now: S.Number },
  ChangedFieldValue: { taskFieldId: S.String, value: S.String },
  /** Typing paused, or the page is being hidden or left: write pending answers. */
  SettledFieldInput: {},
  BlurredField: {},
  AdjustedCounter: { taskFieldId: S.String, delta: S.Literals([-1, 1]) },
  UpdatedFieldValue: {},
  ClickedRecord: {},
  TaskRecorded: {},
  ClickedEndSession: {},
  ConfirmedEndSession: {},
  CanceledEndSession: {},
  SessionEnded: {},
  ClickedSelectTask: { taskId: S.String },
  ToggledTaskList: {},
  FocusedSection: { fieldId: S.Union([S.Null, S.String]) },
  ClickedCancelEdit: {},
  ClickedSaveEdit: {},
  TaskEditStarted: { taskId: S.String },
  TaskEditFinished: {},
  FailedRunnerOp: { error: S.String },
  DismissedRunnerError: {},
  ToggledSidebar: {},

  // ── History tab + Session detail + CSV ──────────────────────────────────────
  GotHistory: { history: S.Array(HistorySessionSummary) },
  GotHistoryDetail: { detail: S.NullOr(HistorySessionDetail) },
  RequestedHistoryDelete: { id: S.String, displayName: S.String },
  OpenedHistoryActions: { id: S.String },
  ClosedHistoryActions: {},
  CanceledHistoryDelete: {},
  ConfirmedHistoryDelete: {},
  HistoryDeleted: {},
  ClickedHistoryRow: { id: S.String },
  ClickedEditHistoryName: {},
  ChangedEditHistoryName: { text: S.String },
  ConfirmedEditHistoryName: {},
  CanceledEditHistoryName: {},
  HistoryNameUpdated: {},
  FailedHistoryOp: { error: S.String },
  ClickedHistoryTask: { taskId: S.String },
  DismissedHistoryTask: {},
  ClickedExportHistoryCsv: { sessionId: S.String, spreadsheetSafe: S.optionalKey(S.Boolean) },
  CsvExported: { filename: S.String },
  FailedCsvExport: { error: S.String },
  DismissedHistoryError: {},
});
export type Message = typeof Message.Type;
