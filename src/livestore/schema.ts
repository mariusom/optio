import { Events, State, makeSchema } from '@livestore/livestore'
import { Schema } from 'effect'

// Payload validated at runtime with Effect (4.0 RC) Schema before any commit.
export const GreetingPayload = Schema.Struct({
  message: Schema.String,
})
export type GreetingPayload = typeof GreetingPayload.Type

// You can model your state as SQLite tables.
export const tables = {
  greetings: State.SQLite.table({
    name: 'greetings',
    columns: {
      id: State.SQLite.text({ primaryKey: true }),
      message: State.SQLite.text({ default: '' }),
      createdAt: State.SQLite.integer({ nullable: false, schema: Schema.DateFromMillis }),
    },
  }),
}

// Events describe data changes.
export const events = {
  greetingCreated: Events.synced({
    name: 'v1.GreetingCreated',
    schema: Schema.Struct({ id: Schema.String, message: Schema.String }),
  }),
  greetingDeleted: Events.synced({
    name: 'v1.GreetingDeleted',
    schema: Schema.Struct({ id: Schema.String }),
  }),
}

const materializers = State.SQLite.materializers(events, {
  'v1.GreetingCreated': ({ id, message }) =>
    tables.greetings.insert({ id, message, createdAt: new Date() }),
  'v1.GreetingDeleted': ({ id }) => tables.greetings.delete().where({ id }),
})

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
