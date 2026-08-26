import { Effect, Queue, Schema as S, Stream } from 'effect'
import { Command, Navigation, Subscription, Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { toString as urlToString, type Url } from 'foldkit/url'

import { Message } from './messages'
import { getStore } from './livestore/client'
import { tables } from './livestore/schema'
import {
  CreateTemplate,
  DeleteTemplate,
  DuplicateTemplate,
  EnsureTemplatesSeeded,
  SetDefaultTemplate,
} from './we/features/templates/commands'
import { templatesPage } from './we/features/templates/view'
import {
  isFullScreenRoute,
  parseRoute,
  RouteSchema,
  templateEditorRouter,
  type Route,
} from './we/routes'
import { bottomTabBar, emptyState, topBar } from './we/ui'

// MODEL — shell state + feature slices

export const Model = S.Struct({
  route: RouteSchema,
  // Templates tab slice
  templates: S.Array(
    S.Struct({
      id: S.String,
      name: S.String,
      isDefault: S.Boolean,
      createdAt: S.Number,
      updatedAt: S.Number,
      fieldCount: S.Number,
      requiredCount: S.Number,
    }),
  ),
  showCreate: S.Boolean,
  newName: S.String,
  pendingDelete: S.Union([S.Null, S.Struct({ id: S.String, name: S.String })]),
  lastError: S.Union([S.Null, S.String]),
})
export type Model = typeof Model.Type

const initialModel = (route: Route): Model => ({
  route,
  templates: [],
  showCreate: false,
  newName: '',
  pendingDelete: null,
  lastError: null,
})

// INIT — first paint parses the URL and seeds sample content if the store is
// empty (Swift seeds on container init; a session can't start without a template)

export const init = (url: Url) => ({
  model: initialModel(parseRoute(url)),
  commands: [EnsureTemplatesSeeded({})],
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

// UPDATE — pure state transitions

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    // ── Routing ────────────────────────────────────────────────────────────
    GotRoute: ({ route }) => ({ model: { ...model, route } }),
    ClickedLink: ({ request }) =>
      request._tag === 'Internal'
        ? { model, commands: [NavigateInternal({ url: urlToString(request.url) })] }
        : { model, commands: [NavigateExternal({ href: request.href })] },
    Navigated: () => ({ model }),

    // ── Templates ──────────────────────────────────────────────────────────
    GotTemplates: ({ templates }) => ({ model: { ...model, templates } }),
    ClickedNewTemplate: () => ({
      model: { ...model, showCreate: true, newName: '', lastError: null },
    }),
    ChangedNewName: ({ text }) => ({ model: { ...model, newName: text } }),
    ConfirmedCreateTemplate: () =>
      model.newName.trim() === ''
        ? { model }
        : {
            model,
            commands: [CreateTemplate({ id: crypto.randomUUID(), name: model.newName.trim() })],
          },
    TemplateCreated: () => ({ model: { ...model, showCreate: false, newName: '' } }),
    CanceledCreateTemplate: () => ({ model: { ...model, showCreate: false, newName: '' } }),
    ClickedTemplateRow: ({ id }) => ({
      model,
      commands: [NavigateInternal({ url: `#${templateEditorRouter({ templateId: id })}` })],
    }),
    DuplicatedTemplate: ({ id }) => ({
      model,
      commands: [NavigateInternal({ url: `#${templateEditorRouter({ templateId: id })}` })],
    }),
    RequestedDeleteTemplate: ({ id, name }) => ({
      model: { ...model, pendingDelete: { id, name } },
    }),
    CanceledDeleteTemplate: () => ({ model: { ...model, pendingDelete: null } }),
    ConfirmedDeleteTemplate: () =>
      model.pendingDelete === null
        ? { model }
        : {
            model: { ...model, pendingDelete: null },
            commands: [DeleteTemplate({ id: model.pendingDelete.id })],
          },
    ClickedSetDefaultTemplate: ({ id }) => ({ model, commands: [SetDefaultTemplate({ id })] }),
    ClickedDuplicateTemplate: ({ id }) => ({ model, commands: [DuplicateTemplate({ id })] }),
    TemplateOpDone: () => ({ model }),
    TemplatesSeededCheck: () => ({ model }),
    FailedTemplateOp: ({ error }) => ({
      model: { ...model, lastError: error, pendingDelete: null },
    }),
  })

// SUBSCRIPTIONS — LiveStore pushes reactive query results into update.
// Two tables merge into one summary payload; either change re-emits.

type TemplateRow = {
  readonly id: string
  readonly name: string
  readonly isDefault: number
  readonly createdAt: number
  readonly updatedAt: number
}
type FieldRow = { readonly templateId: string; readonly isRequired: number }

const buildSummaries = (
  templateRows: ReadonlyArray<TemplateRow>,
  fieldRows: ReadonlyArray<FieldRow>,
) => {
  const counts = new Map<string, { count: number; required: number }>()
  for (const row of fieldRows) {
    const entry = counts.get(row.templateId) ?? { count: 0, required: 0 }
    counts.set(row.templateId, {
      count: entry.count + 1,
      required: entry.required + (row.isRequired === 1 ? 1 : 0),
    })
  }
  return [...templateRows]
    .map(row => {
      const c = counts.get(row.id) ?? { count: 0, required: 0 }
      return {
        id: row.id,
        name: row.name,
        isDefault: row.isDefault === 1,
        createdAt: Number(row.createdAt),
        updatedAt: Number(row.updatedAt),
        fieldCount: c.count,
        requiredCount: c.required,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

const templatesStream: Stream.Stream<Message> = Stream.callback(queue =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const store = await getStore()
      let latestTemplates: ReadonlyArray<TemplateRow> = []
      let latestFields: ReadonlyArray<FieldRow> = []
      const push = () =>
        Queue.offerUnsafe(
          queue,
          Message.GotTemplates({ templates: buildSummaries(latestTemplates, latestFields) }),
        )
      const unsubscribeTemplates = store.subscribe(
        tables.templates.select().orderBy('name', 'asc'),
        rows => {
          latestTemplates = rows as unknown as ReadonlyArray<TemplateRow>
          push()
        },
      )
      const unsubscribeFields = store.subscribe(tables.templateFields.select(), rows => {
        latestFields = (rows as unknown as Array<{ templateId: string; isRequired: number }>).map(r => ({
          templateId: r.templateId,
          isRequired: r.isRequired,
        }))
        push()
      })
      return [unsubscribeTemplates, unsubscribeFields] as const
    }),
    unsubs => Effect.sync(() => unsubs.forEach(unsubscribe => unsubscribe())),
  ).pipe(
    Effect.asVoid,
    Effect.flatMap(() => Effect.never),
  ),
)

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  templates: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () => Stream.when(templatesStream, Effect.sync(() => true)),
    },
  ),
}))

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

const pageFor = (model: Model, h: HtmlBuilder<Message>) => {
  switch (model.route._tag) {
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
      return templatesPage(model, h)
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
      return comingSoon('Session runner', h)
    case 'TemplateEditor':
      return comingSoon('Template editor', h)
    case 'SessionDetail':
      return comingSoon('Session details', h)
  }
}

const comingSoon = (label: string, h: HtmlBuilder<Message>) =>
  h.div([h.Class('flex h-full items-center justify-center text-sm text-base-content/50')], [
    `${label} — coming soon.`,
  ])

const trailingFor = (model: Model, h: HtmlBuilder<Message>) =>
  model.route._tag === 'TemplatesTab' && model.templates.length > 0
    ? h.button(
        [
          h.Class('-mr-2 btn btn-ghost btn-sm text-primary font-semibold hover:bg-transparent active:opacity-60'),
          h.AriaLabel('Create new template'),
          h.OnClick(Message.ClickedNewTemplate()),
        ],
        ['+'],
      )
    : null

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  ({
    title: 'optio',
    body: h.div(
      [h.Class('flex h-dvh w-full flex-col overflow-hidden bg-base-200 text-base-content')],
      [
        topBar(pageTitle(model.route), trailingFor(model, h), h),
        h.main([h.Class('relative flex-1 overflow-y-auto overscroll-y-contain')], [
          pageFor(model, h),
          ...(isFullScreenRoute(model.route)
            ? []
            : [h.div([h.Class('h-[calc(4rem+env(safe-area-inset-bottom))]')], [])]),
        ]),
        ...(isFullScreenRoute(model.route) ? [] : [bottomTabBar(model.route, h)]),
      ],
    ),
  }) satisfies Document
