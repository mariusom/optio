import { Runtime } from 'foldkit'
import { registerSW } from 'virtual:pwa-register'

import './index.css'
import { Model, init, subscriptions, update, view } from './main.ts'

registerSW({ immediate: true })

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById('root')!,
})

Runtime.run(application)
