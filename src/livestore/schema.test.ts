import { Schema as S } from 'effect'
import { describe, expect, test } from 'vitest'

import { GreetingPayload } from './schema.ts'

describe('GreetingPayload runtime validation', () => {
  const decode = S.decodeUnknownSync(GreetingPayload)

  test('accepts a valid payload', () => {
    expect(decode({ message: 'hello world' })).toEqual({ message: 'hello world' })
  })

  test('rejects a non-string message', () => {
    expect(() => decode({ message: 42 })).toThrow()
  })

  test('rejects missing fields', () => {
    expect(() => decode({})).toThrow()
  })
})
