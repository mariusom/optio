import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'

import { validateDraft } from './validate.ts'

const run = (eff: Effect.Effect<string, Error>) => Effect.runPromise(eff)

describe('validateDraft (the exact path CommitGreeting runs)', () => {
  test('accepts and trims a normal message', async () => {
    await expect(run(validateDraft('  hello world '))).resolves.toBe('hello world')
  })

  test('rejects whitespace-only drafts', async () => {
    await expect(run(validateDraft('   '))).rejects.toThrow(/empty/i)
  })

  test('regression: bare-string draft must validate, not throw "Expected object"', async () => {
    // The original bug passed the raw string where an object was required.
    // validateDraft owns the wrapping, so any string input succeeds here.
    await expect(run(validateDraft('plain string'))).resolves.toBe('plain string')
  })

  test('rejects non-string drafts', async () => {
    await expect(run(validateDraft(42))).rejects.toThrow()
    await expect(run(validateDraft(null))).rejects.toThrow()
  })
})
