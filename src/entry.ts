import { Runtime } from 'foldkit'
import type { Url } from 'foldkit/url'
import { registerSW } from 'virtual:pwa-register'

import './index.css'
import { Message } from './messages.ts'
import { parseRoute, StartTab } from './we/routes.ts'
import { Model, init, update, view } from './main.ts'

registerSW({ immediate: true })

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  routing: {
    onUrlRequest: request =>
      request._tag === 'Internal'
        ? Message.GotRoute({ route: parseRoute(request.url) })
        : Message.GotRoute({ route: StartTab() }),
    onUrlChange: (url: Url) => Message.GotRoute({ route: parseRoute(url) }),
  },
  container: document.getElementById('root')!,
})

Runtime.run(application)
