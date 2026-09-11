// The Next line of a held step reads as one thought, built from the engine's own
// hold fragment (stepContract.ts nextCaption). It used to read the fragment
// templates from a content path that does not exist, and opening any held step
// whose next milestone was to resolve, decide or prepare threw while drawing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextCaption, type StepContract } from './stepContract.ts'

const held = (kind: string, gatedBy: string): StepContract => ({ milestone: { line: null, gatedBy, kind } }) as unknown as StepContract

test('a hold waiting on the source groups reads "Next: held until …"', () => {
  assert.equal(nextCaption(held('resolve', 'until the groups the source policy leaves out are identified')), 'Next: held until the groups the source policy leaves out are identified.')
})

test('a hold after another step reads "until <step> is finished"', () => {
  assert.equal(nextCaption(held('decide', 'after: Create the Exclusions Group')), 'Next: held until Create the Exclusions Group is finished.')
})

test('the report-only preparation of a held policy says the enforcement waits', () => {
  assert.equal(nextCaption(held('deploy', 'when 1 MFA grant on this policy exist (now 0)')), 'Next: turning it on waits until 1 MFA grant on this policy exist (now 0).')
  assert.equal(nextCaption(held('deploy', 'when Registered for MFA reaches 90% (now 40%)')), 'Next: turning it on waits until Registered for MFA reaches 90% (now 40%).')
})

test('a milestone with its own line keeps it', () => {
  assert.equal(nextCaption({ milestone: { line: 'Next: watch it.', gatedBy: 'until x', kind: 'resolve' } } as unknown as StepContract), 'Next: watch it.')
})
