import { defineMessageUnion } from 'foldkit/message'

import { RouteSchema } from './we/routes'

// Central flat Message union. Feature payload shapes are grouped by comment;
// reducers live next to their feature views under src/we/features/*.

export const Message = defineMessageUnion({
  // ── Routing ────────────────────────────────────────────────────────────
  GotRoute: { route: RouteSchema },
})
export type Message = typeof Message.Type
