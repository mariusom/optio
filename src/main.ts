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

export const Model = S.Struct({
  draft: S.String,
  lastError: S.Union([S.Null, S.String]),
  greetings: S.Array(Greeting),
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  GotGreetings: { greetings: S.Array(Greeting) },
  ChangedDraft: { text: S.String },
  ClickedAddGreeting: {},
  CommittedGreeting: {},
  FailedValidation: { error: S.String },
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
  })

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: { draft: '', lastError: null, greetings: [] },
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

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'optio — ox-alpha experiment',
  body: h.div(
    [h.Class('hero min-h-screen bg-base-200')],
    [
      h.div([h.Class('hero-content')], [
        h.div([h.Class('flex w-full max-w-md flex-col gap-6 text-center')], [
          h.h1([h.Class('text-4xl font-bold')], ['Hello from ox-alpha']),
          h.p([h.Class('text-sm text-base-content/70')], [
            'FoldKit · LiveStore · Effect RC · Vite+ · Bun — persisted locally, works offline.',
          ]),
          h.div([h.Class('card bg-base-100 shadow-xl')], [
            h.div([h.Class('card-body gap-3')], [
              h.div([h.Class('join w-full')], [
                h.input([
                  h.Class('input input-bordered join-item w-full'),
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
                  [h.Class('btn btn-primary join-item'), h.OnClick(Message.ClickedAddGreeting())],
                  ['Greet'],
                ),
              ]),
              ...(model.lastError !== null
                ? [h.div([h.Class('alert alert-warning py-2 text-sm')], [model.lastError])]
                : []),
              h.div([h.Class('divider my-1 text-xs')], ['stored in SQLite via OPFS']),
              ...(model.greetings.length === 0
                ? [h.p([h.Class('text-sm text-base-content/50')], ['No greetings yet.'])]
                : model.greetings.map(greeting =>
                    h.keyed('div')(greeting.id, [h.Class('chat chat-start')], [
                      h.div([h.Class('chat-bubble chat-bubble-primary')], [greeting.message]),
                    ]),
                  )),
            ]),
          ]),
        ]),
      ]),
    ],
  ),
})
