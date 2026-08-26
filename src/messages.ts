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
});
export type Message = typeof Message.Type;
