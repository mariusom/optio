import { Effect, Schema as S } from 'effect'
import { Command, Navigation, Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { toString as urlToString, type Url } from 'foldkit/url'

import { Message } from './messages'
import {
  isFullScreenRoute,
  parseRoute,
  RouteSchema,
  type Route,
} from './we/routes'
import { bottomTabBar, emptyState, topBar } from './we/ui'

// MODEL — shell state; feature slices extend this over time

export const Model = S.Struct({
  route: RouteSchema,
})
export type Model = typeof Model.Type

// INIT — first paint parses the current URL

export const init = (url: Url) => ({
  model: { route: parseRoute(url) } satisfies Model,
})

// COMMANDS — navigation per foldkit contract: the runtime preventDefaults
// same-origin anchors and hands us the UrlRequest; only pushUrl/load touch
// history, and GotRoute arrives afterwards via onUrlChange.

const NavigateInternal = Command.define('NavigateInternal', {
  args: { url: S.String },
  messages: [Message.Navigated],
  execute: ({ url }) => Effect.map(Navigation.pushUrl(url), () => Message.Navigated()),
})

const NavigateExternal = Command.define('NavigateExternal', {
  args: { href: S.String },
  messages: [Message.Navigated],
  execute: ({ href }) => Effect.map(Navigation.load(href), () => Message.Navigated()),
})

// UPDATE — pure; routing only for now

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    GotRoute: ({ route }) => ({ model: { route } }),
    ClickedLink: ({ request }) =>
      request._tag === 'Internal'
        ? { model, commands: [NavigateInternal({ url: urlToString(request.url) })] }
        : { model, commands: [NavigateExternal({ href: request.href })] },
    Navigated: () => ({ model }),
  })

// VIEW — app shell: top bar, routed page, bottom tab bar

const pageTitle = (route: Route): string => {
  switch (route._tag) {
    case 'StartTab':
      return 'Session'
    case 'HistoryTab':
      return 'History'
    case 'TemplatesTab':
      return 'Templates'
    case 'SessionRunner':
      return 'Session'
    case 'TemplateEditor':
      return 'Edit Template'
    case 'SessionDetail':
      return 'Session Details'
  }
}

const pageFor = (route: Route, h: HtmlBuilder<Message>) => {
  switch (route._tag) {
    case 'StartTab':
      return h.div([h.Class('flex h-full flex-col')], [
        h.div(
          [h.Class('flex flex-1 flex-col items-center justify-center px-6 text-center')],
          [
            h.div(
              [
                h.Class(
                  'flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-serif text-primary shadow-sm',
                ),
              ],
              ['θ'],
            ),
            h.p([h.Class('mt-4 text-lg font-semibold tracking-tight')], ['optio']),
            h.p([h.Class('mt-1 max-w-xs text-sm leading-relaxed text-base-content/60')], [
              'Time & motion studies — recorded locally, never leaving your device.',
            ]),
          ],
        ),
      ])
    case 'TemplatesTab':
      return emptyState(
        {
          icon: 'doc',
          title: 'No Templates',
          message:
            'Create a template to define the fields you want to capture during your time and motion studies.',
        },
        h,
      )
    case 'HistoryTab':
      return emptyState(
        {
          icon: 'clock',
          title: 'No sessions yet',
          message: 'Start a session from the Session tab to begin tracking.',
        },
        h,
      )
    case 'SessionRunner':
    case 'TemplateEditor':
    case 'SessionDetail':
      return h.div(
        [h.Class('flex h-full items-center justify-center text-sm text-base-content/50')],
        ['Coming soon.'],
      )
  }
}

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  ({
    title: 'optio',
    body: h.div(
      [h.Class('flex h-dvh w-full flex-col overflow-hidden bg-base-200 text-base-content')],
      [
        topBar(pageTitle(model.route), null, h),
        h.main([h.Class('relative flex-1 overflow-y-auto overscroll-y-contain')], [
          pageFor(model.route, h),
          ...(isFullScreenRoute(model.route)
            ? []
            : [h.div([h.Class('h-[calc(4rem+env(safe-area-inset-bottom))]')], [])]),
        ]),
        ...(isFullScreenRoute(model.route) ? [] : [bottomTabBar(model.route, h)]),
      ],
    ),
  }) satisfies Document
