import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";

import { FieldDef } from "./domain/fields";
import { RouteSchema } from "./web/routes";
import { TemplateReport, TemplateSummary } from "./web/types";
import { Accent, ControlSize, Font, IconLibrary, Look, Theme } from "./web/theme";
import { FoldcnStyle } from "./web/style";
import { RunnerDataSchema } from "./web/features/session/runner";
import {
  ActiveSessionSummary,
  HistorySessionDetail,
  HistorySessionSummary,
  StoreList,
} from "./app/model";

// Central flat Message union. Payload schemas are grouped by feature;
// root-model handlers are composed by src/app/update.ts.

export const Message = defineMessageUnion({
  AgentRequest: {
    requestId: Schema.String,
    action: Schema.Unknown,
    confirmationVersion: Schema.optionalKey(Schema.Number),
  },
  // ── Storage ────────────────────────────────────────────────────────────
  StoreOpened: { storageMode: Schema.Literals(["persisted", "in-memory"]) },
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
  ThemeSaveFinished: { theme: Theme, saved: Schema.Boolean },
  ChangedSystemColorScheme: { prefersDark: Schema.Boolean },
  AppliedColorScheme: {},
  AppUpdateReady: {},
  ClickedApplyUpdate: {},
  SelectedStyle: { style: FoldcnStyle },
  /** A newer style selection replaced this one before its styles loaded. */
  SupersededStyleSave: {},
  StyleSaveFinished: {
    style: FoldcnStyle,
    appliedStyle: FoldcnStyle,
    saved: Schema.Boolean,
    loadFailed: Schema.Boolean,
  },
  SelectedFont: { font: Font },
  FontSaveFinished: { font: Font, saved: Schema.Boolean },
  SelectedIconLibrary: { library: IconLibrary },
  IconLibrarySaveFinished: { library: IconLibrary, saved: Schema.Boolean },
  SelectedAccent: { accent: Accent },
  AccentSaveFinished: { accent: Accent, saved: Schema.Boolean },
  OpenedAccentPicker: {},
  ChangedAccentDraft: { colour: Schema.String },
  ConfirmedAccentPicker: {},
  CanceledAccentPicker: {},
  SelectedLook: { look: Look },
  LookSaveFinished: { look: Look, saved: Schema.Boolean },
  SelectedControlSize: { controlSize: ControlSize },
  ControlSizeSaveFinished: { controlSize: ControlSize, saved: Schema.Boolean },
  ClickedCopyTemplatePrompt: {},
  TemplatePromptCopyFinished: { copied: Schema.Boolean },
  ResetTemplatePromptCopy: {},

  // ── Templates ──────────────────────────────────────────────────────────
  GotTemplates: { templates: Schema.Array(TemplateSummary) },
  ClickedNewTemplate: {},
  ChangedNewName: { text: Schema.String },
  ConfirmedCreateTemplate: {},
  CanceledCreateTemplate: {},
  TemplateCreated: {},
  ClickedTemplateRow: { id: Schema.String },
  ClickedSetDefaultTemplate: { id: Schema.String },
  ClickedDuplicateTemplate: { id: Schema.String },
  DuplicatedTemplate: { id: Schema.String },
  RequestedDeleteTemplate: { id: Schema.String, name: Schema.String },
  CanceledDeleteTemplate: {},
  ConfirmedDeleteTemplate: {},
  TemplateOpDone: {},
  FailedTemplateOp: { error: Schema.String },
  TemplatesSeededCheck: {},
  OpenedTemplateActions: { id: Schema.String },
  ClosedTemplateActions: {},
  ClickedStartTemplateSession: { id: Schema.String },
  OpenedTemplateReport: { id: Schema.String },
  ClosedTemplateReport: {},
  GotTemplateReport: { report: TemplateReport },
  ClickedAddSampleTemplates: {},
  SampleTemplatesAdded: {},

  // ── Template editor ─────────────────────────────────────────────────────
  GotTemplateDetail: {
    template: Schema.Union([
      Schema.Null,
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        isDefault: Schema.Boolean,
        fields: Schema.Array(FieldDef),
      }),
    ]),
  },
  ChangedEditorName: { text: Schema.String },
  ToggledEditorDefault: {},
  ClickedAddField: {},
  CanceledAddField: {},
  ClickedBackFromField: {},
  ClickedEditField: { id: Schema.String },
  ChangedFieldName: { text: Schema.String },
  ChangedFieldKind: { kind: Schema.String },
  ToggledFieldRequired: {},
  ChangedFieldDefaultValue: { text: Schema.String },
  ToggledFieldDefaultBoolean: {},
  ChangedNewOptionText: { text: Schema.String },
  ConfirmedAddOption: {},
  ClickedDeleteOption: { index: Schema.Number },
  ClickedMoveOption: { index: Schema.Int, direction: Schema.Literals([-1, 1]) },
  ToggledExclusiveOption: { index: Schema.Number },
  ClickedDeleteField: { id: Schema.String },
  ClickedMoveFieldUp: { id: Schema.String },
  ClickedMoveFieldDown: { id: Schema.String },
  ConfirmedSaveField: {},
  ClickedSaveTemplate: {},
  ClickedCancelEditTemplate: {},
  TemplateSaved: {},
  ShowDiscardConfirm: {},
  CanceledDiscard: {},
  ConfirmedDiscard: {},

  // ── Start tab (Session start / Resume / Discard) ──────────────────────────
  ChangedSessionNameInput: { text: Schema.String },
  GotPlaceholderName: { name: Schema.String },
  SelectedTemplate: { id: Schema.String },
  ClickedStartSession: {},
  SessionStarted: { sessionId: Schema.String },
  /** The browser's answer to keeping saved studies; informational only. */
  PersistentStorageChecked: { granted: Schema.Boolean },
  ClickedResumeSession: {},
  ClickedDiscardSession: {},
  ConfirmedDiscardSession: {},
  CanceledDiscardSession: {},
  SessionDiscarded: {},
  GotActiveSession: { activeSession: Schema.NullOr(ActiveSessionSummary) },
  FailedSessionOp: { error: Schema.String },
  FailedDetailLoad: {},
  FailedListRead: { list: StoreList },
  ClickedRetryListRead: {},

  // ── Runner (live session form canvas) ─────────────────────────────────────
  GotRunnerData: {
    data: Schema.Union([Schema.Null, RunnerDataSchema]),
  },
  Tick: { now: Schema.Number },
  ChangedFieldValue: { taskFieldId: Schema.String, value: Schema.String },
  /** Typing paused, or the page is being hidden or left: write pending answers. */
  SettledFieldInput: {},
  BlurredField: {},
  AdjustedCounter: { taskFieldId: Schema.String, delta: Schema.Literals([-1, 1]) },
  UpdatedFieldValue: {},
  ClickedRecord: {},
  /** Ctrl/⌘+Enter on the runner: record the open task, or save the one being edited. */
  PressedPrimaryShortcut: {},
  TaskRecorded: { taskId: Schema.String },
  /** The recorded-task vibration ran, or was skipped where unsupported. */
  GaveRecordFeedback: {},
  ClickedRepeatLastAnswers: {},
  ClickedEndSession: {},
  ConfirmedEndSession: {},
  CanceledEndSession: {},
  SessionEnded: {},
  ClickedSelectTask: { taskId: Schema.String },
  ToggledTaskList: {},
  FocusedSection: { fieldId: Schema.Union([Schema.Null, Schema.String]) },
  ClickedCancelEdit: {},
  ClickedSaveEdit: {},
  TaskEditStarted: { taskId: Schema.String },
  TaskEditFinished: {},
  FailedRunnerOp: { error: Schema.String },
  DismissedRunnerError: {},
  ToggledSidebar: {},

  // ── History tab + Session detail + CSV ──────────────────────────────────────
  GotHistory: { history: Schema.Array(HistorySessionSummary) },
  GotHistoryDetail: { detail: Schema.NullOr(HistorySessionDetail) },
  RequestedHistoryDelete: { id: Schema.String, displayName: Schema.String },
  OpenedHistoryActions: { id: Schema.String },
  ClosedHistoryActions: {},
  CanceledHistoryDelete: {},
  ConfirmedHistoryDelete: {},
  HistoryDeleted: {},
  ClickedHistoryRow: { id: Schema.String },
  ClickedEditHistoryName: {},
  ChangedEditHistoryName: { text: Schema.String },
  ConfirmedEditHistoryName: {},
  CanceledEditHistoryName: {},
  HistoryNameUpdated: {},
  FailedHistoryOp: { error: Schema.String },
  ClickedHistoryTask: { taskId: Schema.String },
  DismissedHistoryTask: {},
  ClickedExportHistoryCsv: {
    sessionId: Schema.String,
    spreadsheetSafe: Schema.optionalKey(Schema.Boolean),
  },
  CsvExported: { filename: Schema.String },
  FailedCsvExport: { error: Schema.String },
  DismissedHistoryError: {},
});
export type Message = typeof Message.Type;

/** One handler per Message tag; update modules pick the tags they own. */
export type MessageHandlers<Result> = {
  readonly [M in Message as M["_tag"]]: (message: M) => Result;
};
