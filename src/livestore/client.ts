import { makePersistedAdapter } from '@livestore/adapter-web'
import LiveStoreSharedWorker from '@livestore/adapter-web/shared-worker?sharedworker'
import { createStorePromise } from '@livestore/livestore'
import { schema } from './schema.ts'
import LiveStoreWorker from './livestore.worker.ts?worker'

// OPFS-persisted, multi-tab capable adapter — data survives reloads and works offline.
const adapter = makePersistedAdapter({
  storage: { type: 'opfs' },
  worker: LiveStoreWorker,
  sharedWorker: LiveStoreSharedWorker,
})

/**
 * Imperative handle on the LiveStore store — FoldKit has no hook bridge,
 * so Commands/Subscriptions await this promise directly.
 */
export const getStore = () =>
  createStorePromise({
    storeId: 'optio-hello',
    schema,
    adapter,
  })

export type AppStore = Awaited<ReturnType<typeof getStore>>
