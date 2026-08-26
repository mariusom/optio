import { Schema as S } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest } from 'foldkit/navigation'

import { RouteSchema } from './we/routes'
import { SessionSummary, TemplateSummary } from './we/types'

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
})
export type Message = typeof Message.Type
