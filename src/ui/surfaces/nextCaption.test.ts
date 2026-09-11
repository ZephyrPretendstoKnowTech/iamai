// The Next caption under a step's badge is only a dated next move (owner,
// 2026-09-11, stepContract.ts nextCaption). A hold's reason is already the row's,
// Readiness's and Fix before continuing's, and the rail names the move; a caption
// restating it was one blocker said five times.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextCaption, type StepContract } from './stepContract.ts'

const held = (kind: string, gatedBy: string): StepContract => ({ milestone: { line: null, gatedBy, kind } }) as unknown as StepContract

test('a hold to resolve, decide or prepare carries no caption', () => {
  assert.equal(nextCaption(held('resolve', 'until the groups the source policy leaves out are identified')), null)
  assert.equal(nextCaption(held('decide', 'after: Create the Exclusions Group')), null)
  assert.equal(nextCaption(held('deploy', 'when Registered for MFA reaches 90% (now 40%)')), null)
})

test('a milestone with its own dated line keeps it', () => {
  assert.equal(nextCaption({ milestone: { line: 'Next: watch it.', gatedBy: 'until x', kind: 'resolve' } } as unknown as StepContract), 'Next: watch it.')
})
