import { defineMessageUnion } from 'foldkit/message'

import { UrlRequest } from 'foldkit/navigation'

import { RouteSchema } from './we/routes'

// Central flat Message union. Feature payload shapes are grouped by comment;
// reducers live next to their feature views under src/we/features/*.

export const Message = defineMessageUnion({
  // ── Routing ────────────────────────────────────────────────────────────
  GotRoute: { route: RouteSchema },
  ClickedLink: { request: UrlRequest },
  Navigated: {},
})
export type Message = typeof Message.Type
