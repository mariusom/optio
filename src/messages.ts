import { Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";

import { FieldDef } from "./livestore/schema";
import { RouteSchema } from "./we/routes";
import { TemplateSummary } from "./we/types";

// Central flat Message union. Payload schemas are grouped by feature;
// reducers live next to their feature views under src/we/features/*.

export const Message = defineMessageUnion({
  // ── Routing ────────────────────────────────────────────────────────────
  GotRoute: { route: RouteSchema },
  ClickedLink: { request: UrlRequest },
  Navigated: {},

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
  ClickedEditField: { id: S.String },
  ChangedFieldName: { text: S.String },
  ChangedFieldKind: { kind: S.String },
  ToggledFieldRequired: {},
  ChangedFieldDefaultValue: { text: S.String },
  ToggledFieldDefaultBoolean: {},
  ChangedNewOptionText: { text: S.String },
  ConfirmedAddOption: {},
  ClickedDeleteOption: { index: S.Number },
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
  SelectedTemplate: { id: S.String },
  ClickedStartSession: {},
  SessionStarted: { sessionId: S.String },
  ClickedResumeSession: {},
  ClickedDiscardSession: {},
  ConfirmedDiscardSession: {},
  CanceledDiscardSession: {},
  SessionDiscarded: {},
  GotActiveSession: {
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
  },
  FailedSessionOp: { error: S.String },

  // ── Runner (live session form canvas) ─────────────────────────────────────
  GotRunnerData: {
    data: S.Union([
      S.Null,
      S.Struct({
        sessionId: S.String,
        templateName: S.String,
        sessionName: S.String,
        startedAt: S.Number,
        tasks: S.Array(
          S.Struct({
            id: S.String,
            orderIndex: S.Number,
            endDate: S.Union([S.Null, S.Number]),
            isBeingEdited: S.Boolean,
            sections: S.Array(
              S.Struct({
                id: S.String,
                taskId: S.String,
                name: S.String,
                kind: S.String,
                isRequired: S.Boolean,
                defaultValue: S.String,
                sortOrder: S.Number,
                options: S.Array(S.String),
                exclusiveOptions: S.Array(S.String),
                value: S.String,
                startDate: S.Union([S.Null, S.Number]),
              }),
            ),
          }),
        ),
        currentTaskId: S.Union([S.Null, S.String]),
        completedCount: S.Number,
      }),
    ]),
  },
  Tick: { now: S.Number },
  ChangedFieldValue: { taskFieldId: S.String, value: S.String },
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
  GotHistory: {
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
  },
  GotHistoryDetail: {
    detail: S.Union([
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
  },
  RequestedHistoryDelete: { id: S.String, displayName: S.String },
  CanceledHistoryDelete: {},
  ConfirmedHistoryDelete: {},
  HistoryDeleted: {},
  ClickedHistoryRow: { id: S.String },
  ClickedEditHistoryName: {},
  ChangedEditHistoryName: { text: S.String },
  ConfirmedEditHistoryName: {},
  CanceledEditHistoryName: {},
  HistoryNameUpdated: {},
  ClickedHistoryTask: { taskId: S.String },
  DismissedHistoryTask: {},
  ClickedExportHistoryCsv: { sessionId: S.String },
  CsvExported: { filename: S.String },
  FailedCsvExport: { error: S.String },
  DismissedCsvError: {},
});
export type Message = typeof Message.Type;
