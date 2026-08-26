import { Effect, Option, Queue, Schema as S, Stream } from 'effect'
import { Command, Runtime, Subscription, Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { evo } from 'foldkit/struct'

import { getStore } from './livestore/client'
import { events, tables } from './livestore/schema'
import { validateDraft } from './livestore/validate'

// MODEL

type Greeting = { readonly id: string; readonly message: string; readonly createdAt: number }

const Greeting = S.Struct({
  id: S.String,
  message: S.String,
  createdAt: S.Number,
})

const EditDraft = S.Struct({
  id: S.String,
  draft: S.String,
})

export const Model = S.Struct({
  draft: S.String,
  lastError: S.Union([S.Null, S.String]),
  greetings: S.Array(Greeting),
  editing: S.Union([S.Null, EditDraft]),
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  GotGreetings: { greetings: S.Array(Greeting) },
  ChangedDraft: { text: S.String },
  ClickedAddGreeting: {},
  CommittedGreeting: {},
  FailedValidation: { error: S.String },
  ClickedDeleteGreeting: { id: S.String },
  DeletedGreeting: {},
  ClickedEditGreeting: { id: S.String, currentText: S.String },
  ChangedEditDraft: { text: S.String },
  ClickedSaveGreeting: {},
  ClickedCancelEdit: {},
  SavedGreetingEdit: {},
})
export type Message = typeof Message.Type

// LIVE QUERY — table builder form, newest first

const allGreetingsQuery = tables.greetings.select().orderBy('createdAt', 'desc')

// COMMANDS — one-shot effects; update stays pure

const CommitGreeting = Command.define('CommitGreeting', {
  args: { message: S.String },
  messages: [Message.CommittedGreeting, Message.FailedValidation],
  execute: ({ message }) =>
    Effect.gen(function* () {
      // Runtime validation (Effect RC Schema) + normalization…
      const trimmed = yield* validateDraft(message)
      // …then commit the event; LiveStore materializes it into SQLite.
      const store = yield* Effect.promise(getStore)
      store.commit(events.greetingCreated({ id: crypto.randomUUID(), message: trimmed }))
      return Message.CommittedGreeting()
    }).pipe(
      Effect.catch(error => Effect.succeed(Message.FailedValidation({ error: String(error) }))),
    ),
})

const DeleteGreeting = Command.define('DeleteGreeting', {
  args: { id: S.String },
  messages: [Message.DeletedGreeting],
  execute: ({ id }) =>
    Effect.gen(function* () {
      const store = yield* Effect.promise(getStore)
      store.commit(events.greetingDeleted({ id }))
      return Message.DeletedGreeting()
    }),
})

const SaveGreetingEdit = Command.define('SaveGreetingEdit', {
  args: { id: S.String, message: S.String },
  messages: [Message.SavedGreetingEdit, Message.FailedValidation],
  execute: ({ id, message }) =>
    Effect.gen(function* () {
      const trimmed = yield* validateDraft(message)
      const store = yield* Effect.promise(getStore)
      store.commit(events.greetingEdited({ id, message: trimmed }))
      return Message.SavedGreetingEdit()
    }).pipe(
      Effect.catch(error => Effect.succeed(Message.FailedValidation({ error: String(error) }))),
    ),
})

// UPDATE — exhaustive, pure state transitions

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    GotGreetings: ({ greetings }) => ({ model: evo(model, { greetings: () => greetings }) }),
    ChangedDraft: ({ text }) => ({ model: evo(model, { draft: () => text }) }),
    ClickedAddGreeting: () => ({
      model,
      commands: [CommitGreeting({ message: model.draft })],
    }),
    CommittedGreeting: () => ({ model: evo(model, { draft: () => '', lastError: () => null }) }),
    FailedValidation: ({ error }) => ({ model: evo(model, { lastError: () => error }) }),
    ClickedDeleteGreeting: ({ id }) => ({
      model,
      commands: [DeleteGreeting({ id })],
    }),
    DeletedGreeting: () => ({ model }),
    ClickedEditGreeting: ({ id, currentText }) => ({
      model: evo(model, {
        editing: () => ({ id, draft: currentText }),
        lastError: () => null,
      }),
    }),
    ChangedEditDraft: ({ text }) => ({
      model: evo(model, {
        editing: editing =>
          editing === null ? null : evo(editing, { draft: () => text }),
      }),
    }),
    ClickedSaveGreeting: () =>
      model.editing === null
        ? { model }
        : {
            model,
            commands: [SaveGreetingEdit({ id: model.editing.id, message: model.editing.draft })],
          },
    ClickedCancelEdit: () => ({ model: evo(model, { editing: () => null }) }),
    SavedGreetingEdit: () => ({
      model: evo(model, { editing: () => null, lastError: () => null }),
    }),
  })

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: { draft: '', lastError: null, greetings: [], editing: null },
})

// SUBSCRIPTIONS — LiveStore pushes reactive query results into update

const greetingsStream: Stream.Stream<Message> = Stream.callback(queue =>
  Effect.acquireRelease(
    Effect.promise(async () => {
      const store = await getStore()
      return store.subscribe(allGreetingsQuery, rows =>
        Queue.offerUnsafe(
          queue,
          Message.GotGreetings({
            greetings: rows.map(row => ({
              id: row.id,
              message: row.message,
              createdAt: Number(row.createdAt),
            })),
          }),
        ),
      )
    }),
    unsubscribe => Effect.sync(() => unsubscribe()),
  ).pipe(
    Effect.asVoid,
    Effect.flatMap(() => Effect.never),
  ),
)

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  greetings: entry(
    { live: S.Boolean },
    {
      modelToDependencies: () => ({ live: true }),
      dependenciesToStream: () => Stream.when(greetingsStream, Effect.sync(() => true)),
    },
  ),
}))

// VIEW — pure Model → daisyUI-styled HTML

const editInputClasses =
  'input input-ghost join-item w-full bg-base-300/40 focus:bg-base-300/70 transition-colors'

const githubUrl = 'https://github.com/mariusom/optio'

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  ({
    title: 'optio',
    body: h.div([h.Class('flex min-h-dvh flex-col bg-base-200')], [
      h.main(
        [h.Class('hero flex-1')],
        [
          h.div([h.Class('hero-content')], [
            h.div([h.Class('flex w-full max-w-md flex-col gap-6 text-center')], [
              h.h1(
                [h.Class('flex items-baseline justify-center gap-2 text-4xl font-bold tracking-tight')],
                [h.span([h.Class('font-serif text-primary')], ['θ']), 'optio'],
              ),
              h.div([h.Class('card bg-base-100 shadow-xl')], [
                h.div([h.Class('card-body gap-3')], [
                  h.div([h.Class('join w-full')], [
                    h.input([
                      h.Class(editInputClasses),
                      h.Value(model.draft),
                      h.Attribute('placeholder', 'Say something…'),
                      h.OnInput(value => Message.ChangedDraft({ text: value })),
                      h.OnKeyDownPreventDefault(key =>
                        key === 'Enter' && model.draft.trim() !== ''
                          ? Option.some(Message.ClickedAddGreeting())
                          : Option.none(),
                      ),
                    ]),
                    h.button(
                      [
                        h.Class('btn btn-primary join-item'),
                        h.OnClick(Message.ClickedAddGreeting()),
                      ],
                      ['Greet'],
                    ),
                  ]),
                  ...(model.editing === null && model.lastError !== null
                    ? [
                        h.div(
                          [h.Class('alert alert-warning py-2 text-sm')],
                          [model.lastError],
                        ),
                      ]
                    : []),
                  ...(model.greetings.length === 0
                    ? [h.p([h.Class('text-sm text-base-content/50')], ['No greetings yet.'])]
                    : model.greetings.map(greeting =>
                        h.keyed('div')(greeting.id, [h.Class('group flex items-center gap-1')], [
                          h.div([h.Class('chat chat-start w-fit max-w-[85%]')], [
                            h.div([h.Class('chat-bubble chat-bubble-primary')], [
                              greeting.message,
                            ]),
                          ]),
                          h.button(
                            [
                              h.Class(
                                'btn btn-circle btn-ghost btn-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                              ),
                              h.AriaLabel(`Edit "${greeting.message}"`),
                              h.OnClick(
                                Message.ClickedEditGreeting({
                                  id: greeting.id,
                                  currentText: greeting.message,
                                }),
                              ),
                            ],
                            ['✎'],
                          ),
                          h.button(
                            [
                              h.Class(
                                'btn btn-circle btn-ghost btn-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                              ),
                              h.AriaLabel(`Delete "${greeting.message}"`),
                              h.OnClick(Message.ClickedDeleteGreeting({ id: greeting.id })),
                            ],
                            ['✕'],
                          ),
                        ]),
                      )),
                ]),
              ]),
            ]),
          ]),
        ],
      ),
      h.footer(
        [
          h.Class(
            'footer footer-center gap-1 border-t border-base-content/10 px-4 py-6 text-base-content/60',
          ),
        ],
        [
          h.p([h.Class('text-sm')], ['Your data never leaves your device.']),
          h.a(
            [
              h.Class('link link-hover inline-flex items-center gap-1.5 text-sm'),
              h.Attribute('href', githubUrl),
              h.Attribute('target', '_blank'),
              h.Attribute('rel', 'noreferrer'),
            ],
            ['GitHub'],
          ),
        ],
      ),
      ...(model.editing === null
        ? []
        : [
            h.div([h.Class('modal modal-open')], [
              h.div([h.Class('modal-box')], [
                h.h3([h.Class('text-lg font-bold')], ['Edit greeting']),
                ...(model.lastError !== null
                  ? [
                      h.div(
                        [h.Class('alert alert-warning mt-3 py-2 text-sm')],
                        [model.lastError],
                      ),
                    ]
                  : []),
                h.input([
                  h.Class(`${editInputClasses} mt-3`),
                  h.Value(model.editing.draft),
                  h.OnInput(value => Message.ChangedEditDraft({ text: value })),
                  h.OnKeyDownPreventDefault(key =>
                    key === 'Enter' && model.editing !== null && model.editing.draft.trim() !== ''
                      ? Option.some(Message.ClickedSaveGreeting())
                      : Option.none(),
                  ),
                ]),
                h.div([h.Class('modal-action')], [
                  h.button(
                    [h.Class('btn btn-ghost'), h.OnClick(Message.ClickedCancelEdit())],
                    ['Cancel'],
                  ),
                  h.button(
                    [h.Class('btn btn-primary'), h.OnClick(Message.ClickedSaveGreeting())],
                    ['Save'],
                  ),
                ]),
              ]),
              h.button([h.Class('modal-backdrop'), h.OnClick(Message.ClickedCancelEdit())], []),
            ]),
          ]),
    ]),
  }) satisfies Document
