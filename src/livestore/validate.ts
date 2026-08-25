import { Effect, Schema as S } from 'effect'

import { GreetingPayload } from './schema.ts'

/**
 * Runtime validation of the raw draft string through the Effect 4 RC Schema,
 * then normalization (trim + emptiness check).
 *
 * Takes the bare string on purpose — wrapping into `{ message }` happens here,
 * at the single place where the payload shape lives.
 */
export const validateDraft = (draft: unknown): Effect.Effect<string, Error> =>
  Effect.gen(function* () {
    // Schema expects { message: string }; we own the wrapping.
    const payload = yield* S.decodeUnknownEffect(GreetingPayload)({ message: draft })
    const trimmed = payload.message.trim()
    if (trimmed.length === 0) {
      return yield* Effect.fail(new Error('Say something first — empty messages are rejected.'))
    }
    return trimmed
  })
